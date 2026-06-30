const fs = require('fs');
const path = require('path');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(__dirname, 'reports');
const DATA_FILE = path.join(__dirname, 'data', 'data.js');

const CATEGORY_MAP = {
  '01-硅酮密封胶': { id: 'silicone', name: '硅酮密封胶' },
  '02-丁基橡胶': { id: 'butyl', name: '丁基橡胶' },
  '03-底涂剂': { id: 'primer', name: '底涂剂' },
  '04-改性硅烷MS胶': { id: 'ms', name: '改性硅烷MS胶' },
  '05-瞬干胶': { id: 'instant', name: '瞬干胶' },
  '06-聚氨酯胶-双组份': { id: 'pu-two', name: '聚氨酯胶-双组份' },
  '07-聚氨酯胶-单组份': { id: 'pu-one', name: '聚氨酯胶-单组份' },
  '08-聚硫胶': { id: 'polysulfide', name: '聚硫胶' }
};

const REPORT_TYPE_MAP = {
  '01-TDS技术数据表': { id: 'tds', name: 'TDS技术数据表' },
  '02-MSDS安全数据表': { id: 'msds', name: 'MSDS安全数据表' },
  '03-防火测试报告': { id: 'fire', name: '防火测试报告' },
  '04-环保检测报告': { id: 'environment', name: '环保检测报告' },
  '05-力学性能报告': { id: 'mechanical', name: '力学性能报告' },
  '06-老化测试报告': { id: 'aging', name: '老化测试报告' },
  '07-供应商资质证书': { id: 'supplier', name: '供应商资质证书' },
  '08-其他': { id: 'other', name: '其他' }
};

const BRAND_LIST = ['回天', '天山', '汉高', '波士', '西卡', '乐泰', '高盟', 'MF', '3M', '道康宁', 'GE', '信越'];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function extractBrandAndModel(folderName) {
  let brand = '', model = folderName;
  for (const b of BRAND_LIST) {
    if (folderName.startsWith(b)) {
      brand = b;
      model = folderName.substring(b.length).trim();
      break;
    }
  }
  if (!brand) {
    const parts = folderName.split(/[\s\-]+/);
    if (parts.length > 1) { brand = parts[0]; model = parts.slice(1).join(' '); }
    else { brand = folderName; model = ''; }
  }
  return { brand, model };
}

function matchReportType(dirName) {
  const name = dirName.toLowerCase();
  if (name.includes('tds')) return REPORT_TYPE_MAP['01-TDS技术数据表'];
  if (name.includes('msds') || name.includes('安全数据')) return REPORT_TYPE_MAP['02-MSDS安全数据表'];
  if (name.includes('防火') || name.includes('fire') || name.includes('阻燃')) return REPORT_TYPE_MAP['03-防火测试报告'];
  if (name.includes('环保') || name.includes('rohs') || name.includes('voc') || name.includes('环境')) return REPORT_TYPE_MAP['04-环保检测报告'];
  if (name.includes('力学') || name.includes('性能') || name.includes('剪切') || name.includes('mech')) return REPORT_TYPE_MAP['05-力学性能报告'];
  if (name.includes('老化') || name.includes('aging') || name.includes('耐')) return REPORT_TYPE_MAP['06-老化测试报告'];
  if (name.includes('供应商') || name.includes('资质') || name.includes('证书') || name.includes('qual')) return REPORT_TYPE_MAP['07-供应商资质证书'];
  if (name.includes('其他') || name.includes('misc')) return REPORT_TYPE_MAP['08-其他'];
  for (const [key, value] of Object.entries(REPORT_TYPE_MAP)) {
    if (dirName.includes(value.name) || dirName.includes(key.substring(3))) return value;
  }
  return null;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getPdfFiles(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const item of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) results.push(...getPdfFiles(fullPath));
    else if (item.toLowerCase().endsWith('.pdf')) results.push({ path: fullPath, name: item, size: stat.size, mtime: stat.mtime });
  }
  return results;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_');
}

function extractBrandAndModelFromFilename(filename) {
  const name = filename.replace(/\.pdf$/i, '');
  for (const b of BRAND_LIST) {
    if (name.startsWith(b)) {
      const rest = name.substring(b.length).trim();
      const match = rest.match(/^([A-Za-z0-9]+)/);
      const model = match ? match[1] : rest;
      return { brand: b, model };
    }
  }
  const match = name.match(/^([^\-_\s]+)[\-_\s]*([A-Za-z0-9]+)?/);
  if (match) return { brand: match[1], model: match[2] || '' };
  return { brand: name, model: '' };
}

function processProductDir(category, prodDir, prodPath, productMap, counters) {
  const { brand, model } = extractBrandAndModel(prodDir);
  const key = category.id + '_' + prodDir;

  let adhesive = productMap.get(key);
  if (!adhesive) {
    adhesive = {
      id: generateId(), category: category.id, brand, model, fullName: prodDir,
      description: '', tags: [], reports: [],
      createTime: new Date().toISOString(), updateTime: new Date().toISOString()
    };
    productMap.set(key, adhesive);
  }

  const safeProdDir = sanitizeFilename(prodDir);
  const destProdDir = path.join(REPORTS_DIR, category.name, safeProdDir);

  const reportDirs = fs.readdirSync(prodPath).filter(f => fs.statSync(path.join(prodPath, f)).isDirectory()).sort();
  for (const repDir of reportDirs) {
    const repType = matchReportType(repDir);
    if (!repType) continue;
    const repPath = path.join(prodPath, repDir);
    const pdfFiles = getPdfFiles(repPath);
    const destTypeDir = path.join(destProdDir, repType.name);

    for (const pdf of pdfFiles) {
      const fileName = sanitizeFilename(pdf.name);
      const destPath = path.join(destTypeDir, fileName);
      const relativePath = 'reports/' + category.name + '/' + safeProdDir + '/' + repType.name + '/' + fileName;
      copyFile(pdf.path, destPath);
      if (counters) counters.copied++;
      adhesive.reports.push({
        id: generateId(), type: repType.id, title: pdf.name.replace(/\.pdf$/i, ''),
        fileName: pdf.name, fileSize: formatFileSize(pdf.size), filePath: relativePath,
        uploadDate: new Date(pdf.mtime).toISOString()
      });
    }
  }
}

function main() {
  console.log('扫描粘接剂报告...');
  if (fs.existsSync(REPORTS_DIR)) fs.rmSync(REPORTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const categoryDirs = fs.readdirSync(SOURCE_ROOT).filter(f => {
    const fp = path.join(SOURCE_ROOT, f);
    return fs.statSync(fp).isDirectory() && CATEGORY_MAP[f];
  }).sort();

  const productMap = new Map();
  const counters = { copied: 0 };

  for (const catDir of categoryDirs) {
    const category = CATEGORY_MAP[catDir];
    const catPath = path.join(SOURCE_ROOT, catDir);

    const subDirs = fs.readdirSync(catPath).filter(f => fs.statSync(path.join(catPath, f)).isDirectory()).sort();

    for (const subDir of subDirs) {
      const subPath = path.join(catPath, subDir);
      const subSubDirs = fs.readdirSync(subPath).filter(f => fs.statSync(path.join(subPath, f)).isDirectory());

      const hasReportTypeDir = subSubDirs.some(d => matchReportType(d));

      if (hasReportTypeDir) {
        processProductDir(category, subDir, subPath, productMap, counters);
      } else {
        const repType = matchReportType(subDir);
        if (!repType) continue;

        const pdfFiles = getPdfFiles(subPath);
        if (pdfFiles.length === 0) continue;

        for (const pdf of pdfFiles) {
          const { brand, model } = extractBrandAndModelFromFilename(pdf.name);
          const prodName = brand + (model ? model : '');
          if (!prodName) continue;

          let adhesive = productMap.get(category.id + '_' + prodName);
          if (!adhesive) {
            adhesive = {
              id: generateId(), category: category.id, brand, model, fullName: prodName,
              description: '', tags: [], reports: [],
              createTime: new Date().toISOString(), updateTime: new Date().toISOString()
            };
            productMap.set(category.id + '_' + prodName, adhesive);
          }

          const safeProdDir = sanitizeFilename(prodName);
          const fileName = sanitizeFilename(pdf.name);
          const destPath = path.join(REPORTS_DIR, category.name, safeProdDir, repType.name, fileName);
          const relativePath = 'reports/' + category.name + '/' + safeProdDir + '/' + repType.name + '/' + fileName;
          copyFile(pdf.path, destPath);
          counters.copied++;

          adhesive.reports.push({
            id: generateId(), type: repType.id, title: pdf.name.replace(/\.pdf$/i, ''),
            fileName: pdf.name, fileSize: formatFileSize(pdf.size), filePath: relativePath,
            uploadDate: new Date(pdf.mtime).toISOString()
          });
        }
      }
    }
  }

  let totalReports = 0;
  const adhesives = [];
  for (const adhesive of productMap.values()) {
    adhesives.push(adhesive);
    totalReports += adhesive.reports.length;
    console.log(`  ${adhesive.fullName} (${adhesive.reports.length}份)`);
  }

  adhesives.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (a.brand + a.model).localeCompare(b.brand + b.model, 'zh');
  });

  const dataJs = 'const ADHESIVES = ' + JSON.stringify(adhesives, null, 2) + ';\n';
  fs.writeFileSync(DATA_FILE, dataJs, 'utf-8');

  console.log(`\n完成！产品:${adhesives.length} 报告:${totalReports} 复制:${counters.copied}`);
  console.log(`数据: ${DATA_FILE}`);
}

main();
