const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

const stages = ["Prospeccao", "Analise", "Documentacao", "Lance", "Arrematado", "Registro", "Reforma", "Venda", "Lucro"];

const pageTitles = {
  dashboard: "Dashboard Executivo",
  search: "Buscar Oportunidades",
  ai: "Inteligencia Artificial",
  reports: "Relatorios",
  legal: "Analise Juridica",
  finance: "Analise Financeira",
  market: "Comparador de Mercado",
  crm: "CRM dos Imoveis",
  agenda: "Agenda de Leiloes",
  history: "Historico",
  portfolio: "Patrimonio",
  settings: "Configuracoes",
};

const connectors = [
  { name: "Caixa", kind: "API oficial", enabled: true, reliability: 96 },
  { name: "Santander", kind: "Scraping publico", enabled: true, reliability: 82 },
  { name: "Bradesco", kind: "Scraping publico", enabled: true, reliability: 78 },
  { name: "Banco do Brasil", kind: "API oficial", enabled: true, reliability: 91 },
  { name: "Portal Zuk", kind: "Scraping publico", enabled: true, reliability: 86 },
  { name: "Mega Leiloes", kind: "Scraping publico", enabled: true, reliability: 84 },
  { name: "Frazao", kind: "Base propria", enabled: true, reliability: 88 },
  { name: "Editais importados", kind: "Base propria", enabled: true, reliability: 99 },
];

const sampleProperties = [
  makeProperty("Campinas", "Taquaral", "Caixa", "Frazao", "Casa", 420000, 250000, 96, 18, 7, "Analise", false, "2026-07-08", "Rua das Acacias"),
  makeProperty("Sorocaba", "Campolim", "Santander", "Mega Leiloes", "Casa", 380000, 220000, 88, 22, 8, "Lance", false, "2026-07-11", "Rua Bolivia"),
  makeProperty("Jundiai", "Anhangabau", "Banco do Brasil", "Zuk", "Casa", 510000, 295000, 91, 16, 6, "Documentacao", false, "2026-07-15", "Rua Prudente"),
  makeProperty("Santos", "Gonzaga", "Santander", "Mega Leiloes", "Apartamento", 920000, 505000, 90, 26, 9, "Arrematado", true, "2026-08-02", "Av. Ana Costa"),
  makeProperty("Sao Paulo", "Mooca", "Bradesco", "Leilao Imovel", "Sala comercial", 680000, 430000, 64, 58, 14, "Venda", true, "2026-07-29", "Rua da Mooca"),
  makeProperty("Ribeirao Preto", "Jardim Iraja", "Itau", "Portal Zuk", "Terreno", 460000, 245000, 72, 32, 11, "Prospeccao", false, "2026-08-10", "Av. Presidente Vargas"),
];

function makeProperty(city, district, bank, auctioneer, type, marketValue, auctionValue, liquidity, legalRisk, saleMonths, stage, owned, auctionDate, address) {
  const renovation = Math.round(marketValue * 0.075);
  return {
    id: crypto.randomUUID(),
    city,
    state: "SP",
    district,
    bank,
    auctioneer,
    source: auctioneer,
    type,
    address,
    area: type === "Terreno" ? 320 : type === "Casa" ? 125 : 82,
    garage: type === "Casa" ? 2 : 1,
    financing: true,
    occupied: legalRisk > 35,
    marketValue,
    firstAuction: Math.round(auctionValue * 1.28),
    secondAuction: auctionValue,
    maxBid: Math.round(marketValue * 0.72 - renovation),
    renovation,
    vacancy: legalRisk > 35 ? 22000 : 9000,
    commissionRate: 0.05,
    itbiRate: 0.03,
    registerCost: 4500,
    condoDebt: type === "Apartamento" ? 18000 : 0,
    iptuDebt: legalRisk > 40 ? 9500 : 0,
    saleMonths,
    legalRisk,
    liquidity,
    stage,
    owned,
    auctionDate,
    importedAt: "2026-06-25",
  };
}

function defaultState() {
  return {
    capitalAvailable: 1250000,
    properties: sampleProperties,
    savedSearches: [],
    searchFilters: {
      state: "SP",
      city: "Campinas",
      radius: 100,
      maxPrice: 300000,
      type: "Casa",
      financing: "Sim",
      occupied: "Nao",
      minDiscount: 35,
      minArea: 70,
      garage: 2,
    },
    settings: {
      targetRoi: 30,
      maxLegalRisk: 45,
      minimumSafetyMargin: 15,
      maxPayback: 12,
    },
    history: [
      "Monitoramento iniciado com 8 fontes configuradas.",
      "Filtro Campinas / Casa / ate R$ 300 mil salvo.",
      "3 oportunidades acima de score 90 detectadas.",
    ],
  };
}

let state = loadState();

function loadState() {
  const saved = localStorage.getItem("fibonacci-invest-platform");
  return saved ? JSON.parse(saved) : defaultState();
}

function saveState() {
  localStorage.setItem("fibonacci-invest-platform", JSON.stringify(state));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, min, max) {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100);
}

function isClosedAuction(item) {
  return String(item.status || "").toLowerCase().includes("encerr");
}

function enrichBase(item) {
  const commission = item.secondAuction * item.commissionRate;
  const itbi = item.secondAuction * item.itbiRate;
  const acquisitionCost = item.secondAuction;
  const totalCost = acquisitionCost + item.renovation + item.vacancy + commission + itbi + item.registerCost + item.condoDebt + item.iptuDebt;
  const profit = item.marketValue - totalCost;
  const roi = totalCost > 0 ? profit / totalCost : 0;
  const discount = item.marketValue > 0 ? 1 - item.secondAuction / item.marketValue : 0;
  const safetyMargin = item.marketValue > 0 ? (item.marketValue - totalCost) / item.marketValue : 0;
  const financialRisk = Math.max(0, Math.min(100, 100 - roi * 180 - safetyMargin * 90 + item.saleMonths * 2));
  const discountScore = clamp(discount * 100);
  const roiScore = scale(roi, -0.1, 0.55);
  const safetyScore = scale(safetyMargin, -0.05, 0.45);
  const riskScore = clamp(100 - item.legalRisk);
  const statusPenalty = isClosedAuction(item) ? 18 : 0;
  const rightsPenalty = String(item.flags || "").toLowerCase().includes("direitos") ? 6 : 0;
  const rawScore = clamp(
    discountScore * 0.28 +
    roiScore * 0.30 +
    safetyScore * 0.20 +
    item.liquidity * 0.10 +
    riskScore * 0.12 -
    statusPenalty -
    rightsPenalty
  );
  return { ...item, acquisitionCost, commission, itbi, totalCost, profit, roi, discount, safetyMargin, financialRisk, rawScore };
}

function classifyByPortfolio(list) {
  const sorted = [...list].sort((a, b) => b.rawScore - a.rawScore);
  const count = Math.max(1, sorted.length);
  const rankById = new Map(sorted.map((item, index) => [item.id, index]));
  return list.map((item) => {
    const rank = rankById.get(item.id) ?? count - 1;
    const percentile = count === 1 ? 100 : 100 - (rank / (count - 1)) * 100;
    const score = Math.round(clamp(item.rawScore * 0.68 + percentile * 0.32));
    const hardRisk = item.legalRisk >= 82 || isClosedAuction(item);
    const noProfit = item.profit <= 0 || item.roi <= 0;
    let recommendation = "Evitar";
    if (!hardRisk && !noProfit && percentile >= 88 && score >= 72) recommendation = "Comprar";
    else if (!hardRisk && !noProfit && percentile >= 58 && score >= 58) recommendation = "Negociar";
    else if (!hardRisk && !noProfit && (percentile >= 25 || score >= 42)) recommendation = "Monitorar";
    return { ...item, percentile, score, recommendation };
  });
}

function allProperties() {
  return classifyByPortfolio(state.properties.map(enrichBase)).sort((a, b) => b.score - a.score);
}

function getTotals() {
  const list = allProperties();
  const owned = list.filter((item) => item.owned);
  const invested = owned.reduce((sum, item) => sum + item.totalCost, 0);
  const expectedProfit = list.reduce((sum, item) => sum + Math.max(0, item.profit), 0);
  const avgRoi = list.length ? list.reduce((sum, item) => sum + item.roi, 0) / list.length : 0;
  return {
    list,
    owned,
    invested,
    freeCapital: state.capitalAvailable - invested,
    expectedProfit,
    avgRoi,
    highScore: list.filter((item) => ["Comprar", "Negociar"].includes(item.recommendation)).length,
    newSinceYesterday: list.filter((item) => item.importedAt === "2026-06-25").length,
  };
}

function render() {
  renderDashboard();
  renderSearch();
  renderSources();
  renderAi();
  renderMarket();
  renderFinance();
  renderCrm();
  renderAgenda();
  renderHistory();
  renderPortfolio();
  renderSettings();
}

function renderDashboard() {
  const totals = getTotals();
  const metrics = [
    ["Capital disponivel", currency.format(state.capitalAvailable), "Base de caixa"],
    ["Patrimonio investido", currency.format(totals.invested), `${totals.owned.length} ativos em carteira`],
    ["Capital livre", currency.format(totals.freeCapital), "Pronto para arrematacao"],
    ["Lucro previsto", currency.format(totals.expectedProfit), "Pipeline monitorado"],
    ["ROI medio", percent.format(totals.avgRoi), "Projetado"],
    ["Imoveis monitorados", String(totals.list.length), "Base propria"],
    ["Novos desde ontem", String(totals.newSinceYesterday), "Monitoramento diario"],
    ["Comprar ou negociar", String(totals.highScore), "Calibrado por ranking estatistico"],
  ];
  document.getElementById("metricsGrid").innerHTML = metrics.map(([label, value, note]) => `
    <article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>
  `).join("");
  document.getElementById("sidebarPortfolio").textContent = currency.format(totals.invested);
  document.getElementById("rankingList").innerHTML = totals.list.slice(0, 5).map((item) => `
    <article class="ranking-item">
      <strong>${item.city} - ${item.district}</strong>
      <span class="ranking-meta">${item.type} | ${currency.format(item.profit)} lucro | ROI ${percent.format(item.roi)} | ${item.recommendation}</span>
      <div class="score-line"><i style="width:${item.score}%"></i></div>
    </article>
  `).join("");
}

function renderSearch() {
  const filters = state.searchFilters;
  const fields = [
    ["state", "Estado", filters.state, "text"],
    ["city", "Cidade", filters.city, "text"],
    ["radius", "Raio km", filters.radius, "number"],
    ["maxPrice", "Valor maximo", filters.maxPrice, "number"],
    ["type", "Tipo", filters.type, "text"],
    ["financing", "Aceita financiamento", filters.financing, "text"],
    ["occupied", "Ocupado", filters.occupied, "text"],
    ["minDiscount", "Desconto minimo %", filters.minDiscount, "number"],
    ["minArea", "Area minima m2", filters.minArea, "number"],
    ["garage", "Garagem vagas", filters.garage, "number"],
  ];
  document.getElementById("searchForm").innerHTML = fields.map(([key, label, value, type]) => fieldHtml(key, label, value, type)).join("");
  document.querySelectorAll("#searchForm input").forEach((input) => {
    input.addEventListener("input", () => {
      state.searchFilters[input.name] = input.type === "number" ? Number(input.value || 0) : input.value;
      saveState();
    });
  });
  renderSearchRows(filterProperties());
}

function filterProperties() {
  const f = state.searchFilters;
  return allProperties().filter((item) => {
    const cityOk = !f.city || item.city.toLowerCase().includes(String(f.city).toLowerCase()) || Number(f.radius) >= 80;
    const typeOk = !f.type || item.type.toLowerCase().includes(String(f.type).toLowerCase());
    const priceOk = item.secondAuction <= Number(f.maxPrice || Infinity);
    const discountOk = item.discount * 100 >= Number(f.minDiscount || 0);
    const areaOk = item.area >= Number(f.minArea || 0);
    const garageOk = item.garage >= Number(f.garage || 0);
    const financingOk = String(f.financing).toLowerCase().startsWith("s") ? item.financing : true;
    const occupiedOk = String(f.occupied).toLowerCase().startsWith("n") ? !item.occupied : true;
    return cityOk && typeOk && priceOk && discountOk && areaOk && garageOk && financingOk && occupiedOk;
  });
}

function renderSearchRows(rows) {
  document.getElementById("searchRows").innerHTML = rows.map((item) => `
    <tr>
      <td>${item.city}</td>
      <td>${item.district}</td>
      <td>${item.source}</td>
      <td>${currency.format(item.marketValue)}</td>
      <td>${currency.format(item.secondAuction)}</td>
      <td>${percent.format(item.discount)}</td>
      <td>${currency.format(item.profit)}</td>
      <td>${percent.format(item.roi)}</td>
      <td>${item.score}</td>
      <td><span class="status-pill ${statusClass(item.recommendation)}">${item.recommendation}</span></td>
      <td><button class="small-button" data-detail="${item.id}">Abrir</button></td>
    </tr>
  `).join("") || `<tr><td colspan="11">Nenhum imovel encontrado com os filtros atuais.</td></tr>`;
  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => openDetail(button.dataset.detail));
  });
}

function renderSources() {
  document.getElementById("sourceStatus").innerHTML = connectors.map((source) => `
    <article class="source-card">
      <strong>${source.name}</strong>
      <span>${source.kind}</span>
      <div class="score-line"><i style="width:${source.reliability}%"></i></div>
    </article>
  `).join("");
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickRowValue(row, aliases) {
  const wanted = aliases.map(normalizeHeader);
  const entry = Object.entries(row).find(([key]) => wanted.includes(normalizeHeader(key)));
  return entry ? entry[1] : "";
}

function pickFirstFilledRowValue(row, aliasGroups) {
  for (const aliases of aliasGroups) {
    const value = pickRowValue(row, aliases);
    if (String(value ?? "").trim() !== "") return value;
  }
  return "";
}

function parseMoney(value, fallback = 0) {
  if (typeof value === "number") return value;
  const text = String(value || "").trim();
  if (!text) return fallback;
  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumberValue(value, fallback = 0) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePercentValue(value, fallback = 0) {
  const parsed = parseNumberValue(value, fallback);
  return parsed > 1 ? parsed : parsed * 100;
}

function parseBooleanValue(value, fallback = false) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  return ["sim", "s", "yes", "true", "1"].includes(text);
}

function excelSerialToDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Number(serial) * 86400000).toISOString().slice(0, 10);
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 25000 && value < 80000) {
    return excelSerialToDate(value);
  }
  const text = String(value || "").trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  if (/^\d{5}$/.test(text)) return excelSerialToDate(Number(text));
  const brMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
    return `${year}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }
  return text.slice(0, 10);
}

function extractAreaFromText(text, fallback) {
  const match = String(text || "").match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*m[²2]/i);
  return match ? parseNumberValue(match[1], fallback) : fallback;
}

function inferLegalRisk(row) {
  const text = [
    pickRowValue(row, ["descricao", "descrição"]),
    pickRowValue(row, ["flags"]),
    pickRowValue(row, ["tipo de leilao", "tipo de leilão"]),
    pickRowValue(row, ["status"]),
  ].join(" ").toLowerCase();
  let risk = 22;
  if (text.includes("judicial")) risk += 10;
  if (text.includes("direitos")) risk += 14;
  if (text.includes("ocupado") || text.includes("ocupacao") || text.includes("ocupação")) risk += 18;
  if (text.includes("indisponibilidade")) risk += 12;
  if (text.includes("penhora")) risk += 8;
  if (text.includes("iptu") || text.includes("condominio") || text.includes("condomínio")) risk += 5;
  if (text.includes("encerrado")) risk += 20;
  return Math.max(0, Math.min(100, risk));
}

function inferStage(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("encerr")) return "Historico";
  if (text.includes("aberto")) return "Prospeccao";
  return "Prospeccao";
}

function readUInt16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("Este navegador nao possui leitor ZIP interno para XLSX.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (readUInt32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo XLSX invalido.");
  const entries = readUInt16(bytes, eocd + 10);
  let cursor = readUInt32(bytes, eocd + 16);
  const files = {};
  for (let i = 0; i < entries; i += 1) {
    if (readUInt32(bytes, cursor) !== 0x02014b50) throw new Error("Indice ZIP invalido.");
    const method = readUInt16(bytes, cursor + 10);
    const compressedSize = readUInt32(bytes, cursor + 20);
    const nameLength = readUInt16(bytes, cursor + 28);
    const extraLength = readUInt16(bytes, cursor + 30);
    const commentLength = readUInt16(bytes, cursor + 32);
    const localOffset = readUInt32(bytes, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = readUInt16(bytes, localOffset + 26);
    const localExtraLength = readUInt16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    files[name] = method === 0 ? compressed : await inflateRaw(compressed);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function xmlDoc(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnIndex(ref) {
  const letters = String(ref || "").replace(/[^A-Z]/gi, "").toUpperCase();
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(files) {
  if (!files["xl/sharedStrings.xml"]) return [];
  const text = new TextDecoder("utf-8").decode(files["xl/sharedStrings.xml"]);
  return [...xmlDoc(text).getElementsByTagName("si")].map((si) =>
    [...si.getElementsByTagName("t")].map((node) => node.textContent || "").join("")
  );
}

function resolveFirstSheetPath(files) {
  const decoder = new TextDecoder("utf-8");
  if (!files["xl/workbook.xml"] || !files["xl/_rels/workbook.xml.rels"]) return "xl/worksheets/sheet1.xml";
  const workbook = xmlDoc(decoder.decode(files["xl/workbook.xml"]));
  const firstSheet = workbook.getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");
  if (!relId) return "xl/worksheets/sheet1.xml";
  const rels = xmlDoc(decoder.decode(files["xl/_rels/workbook.xml.rels"]));
  const rel = [...rels.getElementsByTagName("Relationship")].find((item) => item.getAttribute("Id") === relId);
  const target = rel?.getAttribute("Target") || "worksheets/sheet1.xml";
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^xl\//, "")}`;
}

function parseSheetRows(files) {
  const decoder = new TextDecoder("utf-8");
  const sharedStrings = parseSharedStrings(files);
  const sheetPath = resolveFirstSheetPath(files);
  if (!files[sheetPath]) throw new Error("Primeira aba da planilha nao encontrada.");
  const sheet = xmlDoc(decoder.decode(files[sheetPath]));
  const rows = [...sheet.getElementsByTagName("row")].map((row) => {
    const values = [];
    [...row.getElementsByTagName("c")].forEach((cell) => {
      const index = columnIndex(cell.getAttribute("r"));
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent || "";
      const inline = cell.getElementsByTagName("t")[0]?.textContent || "";
      let value = raw;
      if (type === "s") value = sharedStrings[Number(raw)] || "";
      if (type === "inlineStr") value = inline;
      if (!type && raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
      values[index] = value;
    });
    return values;
  });
  const headers = (rows.shift() || []).map((header) => String(header || "").trim());
  return rows
    .filter((row) => row.some((value) => String(value || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

async function readXlsxRows(file) {
  const files = await unzipXlsx(await file.arrayBuffer());
  return parseSheetRows(files);
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function writeUInt16(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = (value >>> 8) & 255;
}

function writeUInt32(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = (value >>> 8) & 255;
  target[offset + 2] = (value >>> 16) & 255;
  target[offset + 3] = (value >>> 24) & 255;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    writeUInt32(local, 0, 0x04034b50);
    writeUInt16(local, 4, 20);
    writeUInt16(local, 8, 0);
    writeUInt32(local, 14, crc);
    writeUInt32(local, 18, data.length);
    writeUInt32(local, 22, data.length);
    writeUInt16(local, 26, nameBytes.length);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    writeUInt32(central, 0, 0x02014b50);
    writeUInt16(central, 4, 20);
    writeUInt16(central, 6, 20);
    writeUInt16(central, 10, 0);
    writeUInt32(central, 16, crc);
    writeUInt32(central, 20, data.length);
    writeUInt32(central, 24, data.length);
    writeUInt16(central, 28, nameBytes.length);
    writeUInt32(central, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });
  const centralDir = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUInt32(end, 0, 0x06054b50);
  writeUInt16(end, 8, Object.keys(files).length);
  writeUInt16(end, 10, Object.keys(files).length);
  writeUInt32(end, 12, centralDir.length);
  writeUInt32(end, 16, offset);
  return concatBytes([...localParts, centralDir, end]);
}

function createTemplateXlsx() {
  const headers = ["Cidade", "Bairro", "Estado", "Banco", "Leiloeiro", "Tipo", "Endereco", "Valor mercado", "Valor leilao", "Area", "Garagem", "Data leilao", "Risco juridico", "Liquidez", "Reforma", "Ocupado", "Financiamento"];
  const sample = ["Campinas", "Taquaral", "SP", "Caixa", "Frazao", "Casa", "Rua exemplo, 100", 700000, 360000, 120, 2, "2026-08-20", 28, 78, 45000, "Nao", "Sim"];
  const rows = [headers, sample].map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => {
    const col = String.fromCharCode(65 + colIndex);
    const ref = `${col}${rowIndex + 1}`;
    return typeof value === "number"
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  return createZip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Oportunidades" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheetXml,
  });
}

function rowToPropertyLegacy(row) {
  const city = String(pickRowValue(row, ["cidade", "city", "municipio"]) || "").trim();
  const district = String(pickRowValue(row, ["bairro", "district", "regiao"]) || "").trim();
  const marketValue = parseMoney(pickRowValue(row, ["valor mercado", "avaliacao", "valor avaliacao", "market value"]), 0);
  const secondAuction = parseMoney(pickRowValue(row, ["valor leilao", "segundo leilao", "2 leilao", "lance inicial", "auction value"]), 0);
  if (!city || !district || !marketValue || !secondAuction) return null;
  const type = String(pickRowValue(row, ["tipo", "type", "imovel"]) || "Imovel").trim();
  const legalRisk = Math.max(0, Math.min(100, parsePercentValue(pickRowValue(row, ["risco juridico", "legal risk"]), 28)));
  const liquidity = Math.max(0, Math.min(100, parsePercentValue(pickRowValue(row, ["liquidez", "liquidity"]), 74)));
  const renovation = parseMoney(pickRowValue(row, ["reforma", "custo reforma"]), Math.round(marketValue * 0.07));
  const auctioneer = String(pickRowValue(row, ["leiloeiro", "auctioneer", "fonte"]) || "XLSX importado").trim();
  return {
    id: crypto.randomUUID(),
    city,
    state: String(pickRowValue(row, ["estado", "uf", "state"]) || "SP").trim(),
    district,
    bank: String(pickRowValue(row, ["banco", "bank"]) || "Base propria").trim(),
    auctioneer,
    source: auctioneer,
    type,
    address: String(pickRowValue(row, ["endereco", "endereço", "address"]) || "").trim(),
    area: parseNumberValue(pickRowValue(row, ["area", "area m2", "m2", "metragem"]), type === "Terreno" ? 320 : 82),
    garage: parseNumberValue(pickRowValue(row, ["garagem", "vagas", "garage"]), 1),
    financing: parseBooleanValue(pickRowValue(row, ["financiamento", "aceita financiamento"]), true),
    occupied: parseBooleanValue(pickRowValue(row, ["ocupado", "ocupacao", "ocupação"]), false),
    marketValue,
    firstAuction: parseMoney(pickRowValue(row, ["primeiro leilao", "1 leilao"]), Math.round(secondAuction * 1.28)),
    secondAuction,
    maxBid: parseMoney(pickRowValue(row, ["lance maximo", "lance pretendido", "max bid"]), Math.round(marketValue * 0.72 - renovation)),
    renovation,
    vacancy: parseMoney(pickRowValue(row, ["desocupacao", "desocupação"]), legalRisk > 35 ? 22000 : 9000),
    commissionRate: parseNumberValue(pickRowValue(row, ["comissao %", "comissão %"]), 5) / 100,
    itbiRate: parseNumberValue(pickRowValue(row, ["itbi %"]), 3) / 100,
    registerCost: parseMoney(pickRowValue(row, ["registro", "custo registro"]), 4500),
    condoDebt: parseMoney(pickRowValue(row, ["condominio", "condomínio", "divida condominio"]), 0),
    iptuDebt: parseMoney(pickRowValue(row, ["iptu", "divida iptu"]), 0),
    saleMonths: parseNumberValue(pickRowValue(row, ["meses venda", "prazo venda"]), 9),
    legalRisk,
    liquidity,
    stage: String(pickRowValue(row, ["etapa", "stage"]) || "Prospeccao").trim(),
    owned: parseBooleanValue(pickRowValue(row, ["patrimonio", "arrematado", "owned"]), false),
    auctionDate: parseDateValue(pickRowValue(row, ["data leilao", "data do leilao", "auction date"])),
    importedAt: new Date().toISOString().slice(0, 10),
  };
}

function rowToProperty(row) {
  const city = String(pickRowValue(row, ["cidade", "city", "municipio", "município"]) || "").trim();
  const rawDistrict = String(pickRowValue(row, ["bairro", "district", "regiao", "região"]) || "").trim();
  const title = String(pickRowValue(row, ["titulo", "título", "title"]) || "").trim();
  const description = String(pickRowValue(row, ["descricao", "descrição", "description"]) || "").trim();
  const address = String(pickRowValue(row, ["endereco", "endereço", "address"]) || "").trim();
  const marketValue = parseMoney(pickFirstFilledRowValue(row, [
    ["valor mercado", "avaliacao", "avaliação", "valor avaliacao", "valor avaliação", "market value"],
    ["valor 1"],
    ["valor 2"],
  ]), 0);
  const firstAuction = parseMoney(pickFirstFilledRowValue(row, [
    ["valor 1", "primeiro leilao", "primeiro leilão", "1 leilao", "1 leilão"],
    ["valor leilao", "valor leilão"],
  ]), 0);
  const secondAuction = parseMoney(pickFirstFilledRowValue(row, [
    ["valor 2", "segundo leilao", "segundo leilão", "2 leilao", "2 leilão"],
    ["valor 3", "terceiro leilao", "terceiro leilão", "3 leilao", "3 leilão"],
    ["valor ultimo lance", "valor último lance"],
    ["valor leilao", "valor leilão", "lance inicial", "auction value"],
    ["valor 1"],
  ]), 0);
  if (!city || !marketValue || !secondAuction) return null;
  const type = String(pickFirstFilledRowValue(row, [
    ["subcategoria", "tipo", "type", "imovel", "imóvel"],
    ["categoria"],
  ]) || "Imovel").trim();
  const district = rawDistrict || "Nao informado";
  const explicitRisk = pickRowValue(row, ["risco juridico", "risco jurídico", "legal risk"]);
  const legalRisk = explicitRisk === "" ? inferLegalRisk(row) : Math.max(0, Math.min(100, parsePercentValue(explicitRisk, 28)));
  const liquidity = Math.max(0, Math.min(100, parsePercentValue(pickRowValue(row, ["liquidez", "liquidity"]), 74)));
  const renovation = parseMoney(pickRowValue(row, ["reforma", "custo reforma"]), type.toLowerCase().includes("lote") || type.toLowerCase().includes("terreno") ? 0 : Math.round(marketValue * 0.07));
  const auctioneer = String(pickRowValue(row, ["leiloeiro", "auctioneer", "fonte"]) || "XLSX importado").trim();
  const status = String(pickRowValue(row, ["status"]) || "").trim();
  const discountValue = parsePercentValue(pickRowValue(row, ["desconto"]), 0);
  const auctionDate = parseDateValue(pickFirstFilledRowValue(row, [
    ["maior data"],
    ["data 2"],
    ["data 3"],
    ["data 1"],
    ["data leilao", "data leilão", "data do leilao", "data do leilão", "auction date"],
  ]));
  const documentUrls = ["documento 01", "documento 02", "documento 03", "documento 04", "documento 05"]
    .map((key) => String(pickRowValue(row, [key]) || "").trim())
    .filter(Boolean);
  const imageUrls = ["imagem 01", "imagem 02", "imagem 03", "imagem 04", "imagem 05"]
    .map((key) => String(pickRowValue(row, [key]) || "").trim())
    .filter(Boolean);
  return {
    id: crypto.randomUUID(),
    city,
    state: String(pickRowValue(row, ["estado", "uf", "state"]) || "SP").trim(),
    district,
    bank: String(pickFirstFilledRowValue(row, [["banco", "bank"], ["comitente"]]) || "Base propria").trim(),
    auctioneer,
    source: auctioneer,
    type,
    address,
    area: extractAreaFromText(description || title, parseNumberValue(pickRowValue(row, ["area", "area m2", "m2", "metragem"]), type === "Terreno" || type === "Lote" ? 320 : 82)),
    garage: parseNumberValue(pickRowValue(row, ["garagem", "vagas", "garage"]), 1),
    financing: parseBooleanValue(pickRowValue(row, ["financiamento", "aceita financiamento"]), true),
    occupied: parseBooleanValue(pickRowValue(row, ["ocupado", "ocupacao", "ocupação"]), /ocupad/i.test(description)),
    marketValue,
    firstAuction: firstAuction || Math.round(secondAuction * 1.28),
    secondAuction,
    maxBid: parseMoney(pickRowValue(row, ["lance maximo", "lance pretendido", "max bid"]), Math.round(marketValue * 0.72 - renovation)),
    renovation,
    vacancy: parseMoney(pickRowValue(row, ["desocupacao", "desocupação"]), legalRisk > 35 ? 22000 : 9000),
    commissionRate: parseNumberValue(pickRowValue(row, ["comissao %", "comissão %"]), 5) / 100,
    itbiRate: parseNumberValue(pickRowValue(row, ["itbi %"]), 3) / 100,
    registerCost: parseMoney(pickRowValue(row, ["registro", "custo registro"]), 4500),
    condoDebt: parseMoney(pickRowValue(row, ["condominio", "condomínio", "divida condominio", "dívida condomínio"]), 0),
    iptuDebt: parseMoney(pickRowValue(row, ["iptu", "divida iptu"]), 0),
    saleMonths: parseNumberValue(pickRowValue(row, ["meses venda", "prazo venda"]), 9),
    legalRisk,
    liquidity,
    stage: String(pickRowValue(row, ["etapa", "stage"]) || inferStage(status)).trim(),
    owned: parseBooleanValue(pickRowValue(row, ["patrimonio", "arrematado", "owned"]), false),
    auctionDate,
    importedAt: new Date().toISOString().slice(0, 10),
    title,
    description,
    sourceLink: String(pickRowValue(row, ["link", "url"]) || "").trim(),
    lotId: String(pickRowValue(row, ["id lote", "lote"]) || "").trim(),
    processNumber: String(pickRowValue(row, ["processo"]) || "").trim(),
    status,
    auctionType: String(pickRowValue(row, ["tipo de leilao", "tipo de leilão"]) || "").trim(),
    flags: String(pickRowValue(row, ["flags"]) || "").trim(),
    category: String(pickRowValue(row, ["categoria"]) || "").trim(),
    discountImported: discountValue,
    visits: parseNumberValue(pickRowValue(row, ["numero de visitas", "número de visitas"]), 0),
    habilitated: parseNumberValue(pickRowValue(row, ["numero de habilitados", "número de habilitados"]), 0),
    documentUrls,
    imageUrls,
  };
}

async function importXlsxFile() {
  const fileInput = document.getElementById("xlsxImport");
  const status = document.getElementById("importStatus");
  const file = fileInput.files?.[0];
  if (!file) {
    status.textContent = "Selecione uma planilha .xlsx antes de importar.";
    status.className = "import-status error";
    return;
  }
  try {
    const rows = await readXlsxRows(file);
    const imported = rows.map(rowToProperty).filter(Boolean);
    if (!imported.length) {
      status.textContent = "Nenhuma linha valida encontrada. Confira se existem Cidade, Bairro, Valor mercado e Valor leilao.";
      status.className = "import-status error";
      return;
    }
    state.properties.push(...imported);
    state.history.unshift(`${imported.length} oportunidades importadas da planilha ${file.name}.`);
    saveState();
    render();
    renderSearchRows(filterProperties());
    status.textContent = `${imported.length} oportunidades importadas com sucesso.`;
    status.className = "import-status success";
    fileInput.value = "";
  } catch (error) {
    status.textContent = `Nao foi possivel importar: ${error.message}`;
    status.className = "import-status error";
  }
}

function downloadXlsxTemplate() {
  const blob = new Blob([createTemplateXlsx()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-importacao-fibonacci-invest.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

function renderAi() {
  if (!document.getElementById("aiAnswer").textContent.trim()) {
    document.getElementById("aiAnswer").innerHTML = aiResponse("Qual e o melhor imovel agora?");
  }
  renderReportTools();
  renderMainReportTools();
}

function renderReportTools(selectedId = document.getElementById("reportProperty")?.value) {
  const select = document.getElementById("reportProperty");
  if (!select) return;
  const list = allProperties();
  const currentId = selectedId || list[0]?.id;
  select.innerHTML = list.map((item) => `<option value="${item.id}" ${item.id === currentId ? "selected" : ""}>${item.city} - ${item.district} | Score ${item.score}</option>`).join("");
  const item = list.find((property) => property.id === select.value) || list[0];
  document.getElementById("reportPreview").innerHTML = reportPreviewHtml(item);
}

function renderMainReportTools(selectedId = document.getElementById("reportPropertyMain")?.value) {
  const select = document.getElementById("reportPropertyMain");
  if (!select) return;
  const list = allProperties();
  const currentId = selectedId || list[0]?.id;
  select.innerHTML = list.map((item) => `<option value="${item.id}" ${item.id === currentId ? "selected" : ""}>${item.city} - ${item.district} | ${item.type} | Score ${item.score}</option>`).join("");
  const item = list.find((property) => property.id === select.value) || list[0];
  document.getElementById("reportPreviewMain").innerHTML = reportPreviewHtml(item);
}

function renderMarket() {
  const top = allProperties()[0];
  document.getElementById("marketProperty").textContent = `${top.city} - ${top.district}`;
  const comparables = [
    ["Rua A", top.marketValue * 1.02, top.area, "Zap"],
    ["Rua B", top.marketValue * 0.99, top.area - 8, "VivaReal"],
    ["Rua C", top.marketValue * 1.06, top.area + 12, "Quinto Andar"],
    ["Media do bairro", top.marketValue, top.area, "Consolidado"],
  ];
  document.getElementById("comparableRows").innerHTML = comparables.map(([address, value, area, source]) => `
    <tr><td>${address}</td><td>${currency.format(value)}</td><td>${area} m²</td><td>${source}</td></tr>
  `).join("");
  const indicators = [
    ["Preco medio", currency.format(top.marketValue)],
    ["Preco por m²", currency.format(top.marketValue / top.area)],
    ["Liquidez", `${top.liquidity}/100`],
    ["Tempo medio venda", `${top.saleMonths} meses`],
    ["Renda media regiao", "Alta"],
    ["Seguranca", top.legalRisk > 45 ? "Atencao" : "Adequada"],
  ];
  document.getElementById("regionIndicators").innerHTML = indicators.map(([label, value]) => `
    <div class="indicator"><span>${label}</span><strong>${value}</strong></div>
  `).join("");
}

function renderFinance(selected = allProperties()[0]) {
  const fields = [
    ["marketValue", "Valor de mercado", selected.marketValue],
    ["secondAuction", "Valor do leilao", selected.secondAuction],
    ["maxBid", "Lance pretendido", selected.maxBid],
    ["renovation", "Reforma", selected.renovation],
    ["vacancy", "Desocupacao", selected.vacancy],
    ["registerCost", "Registro", selected.registerCost],
    ["condoDebt", "Condominio pendente", selected.condoDebt],
    ["iptuDebt", "IPTU pendente", selected.iptuDebt],
  ];
  document.getElementById("simulatorForm").innerHTML = fields.map(([key, label, value]) => fieldHtml(key, label, value, "number")).join("");
  document.querySelectorAll("#simulatorForm input").forEach((input) => input.addEventListener("input", updateSimulation));
  updateSimulation();
}

function updateSimulation() {
  const data = Object.fromEntries([...document.querySelectorAll("#simulatorForm input")].map((input) => [input.name, Number(input.value || 0)]));
  const commission = data.secondAuction * 0.05;
  const itbi = data.secondAuction * 0.03;
  const ir = Math.max(0, (data.marketValue - data.maxBid - data.renovation - data.vacancy - data.registerCost - data.condoDebt - data.iptuDebt - commission - itbi) * 0.15);
  const totalCost = data.maxBid + data.renovation + data.vacancy + data.registerCost + data.condoDebt + data.iptuDebt + commission + itbi + ir;
  const profit = data.marketValue - totalCost;
  const roi = totalCost > 0 ? profit / totalCost : 0;
  const safety = data.marketValue > 0 ? profit / data.marketValue : 0;
  const recommendedBid = Math.max(0, data.marketValue * 0.72 - data.renovation - data.vacancy - data.condoDebt - data.iptuDebt);
  const label = roi >= 0.3 && safety >= 0.15 ? "Comprar" : roi >= 0.18 ? "Negociar" : "Evitar";
  document.getElementById("recommendationTag").textContent = label;
  document.getElementById("simulationResult").innerHTML = [
    ["Comissao 5%", currency.format(commission)],
    ["ITBI 3%", currency.format(itbi)],
    ["IR estimado", currency.format(ir)],
    ["Custo total", currency.format(totalCost)],
    ["Lucro esperado", currency.format(profit)],
    ["ROI", percent.format(roi)],
    ["Margem de seguranca", percent.format(safety)],
    ["Lance maximo recomendado", currency.format(recommendedBid)],
  ].map(([labelText, value]) => `<div class="result-item"><span>${labelText}</span><strong>${value}</strong></div>`).join("");
}

function renderCrm() {
  const list = allProperties();
  document.getElementById("crmBoard").innerHTML = stages.map((stage) => `
    <section class="kanban-column">
      <h3>${stage}</h3>
      ${list.filter((item) => item.stage === stage).map(dealCard).join("") || '<div class="deal-card"><span>Nenhum imovel nesta etapa</span></div>'}
    </section>
  `).join("");
  document.querySelectorAll("[data-stage-id]").forEach((select) => {
    select.addEventListener("change", () => {
      const property = state.properties.find((item) => item.id === select.dataset.stageId);
      property.stage = select.value;
      state.history.unshift(`${property.city} - ${property.district} movido para ${select.value}.`);
      saveState();
      render();
    });
  });
}

function dealCard(item) {
  return `<article class="deal-card">
    <strong>${item.city} - ${item.district}</strong>
    <span>${item.type} | Score ${item.score} | ${currency.format(item.profit)}</span>
    <select data-stage-id="${item.id}">
      ${stages.map((stage) => `<option ${stage === item.stage ? "selected" : ""}>${stage}</option>`).join("")}
    </select>
  </article>`;
}

function renderAgenda() {
  document.getElementById("agendaList").innerHTML = allProperties()
    .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate))
    .map((item) => `
      <article class="agenda-item">
        <div><strong>${dateBr(item.auctionDate)}</strong><span>${item.city} - ${item.district}</span></div>
        <div><span>Leilao</span><strong>${currency.format(item.secondAuction)}</strong></div>
        <div><span>Score</span><strong>${item.score}</strong></div>
        <button class="small-button" data-detail="${item.id}">Abrir</button>
      </article>
    `).join("");
  document.querySelectorAll("#agendaList [data-detail]").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.detail)));
}

function renderHistory() {
  document.getElementById("historyList").innerHTML = state.history.map((item, index) => `
    <article class="history-item"><strong>${String(index + 1).padStart(2, "0")}</strong><span>${item}</span></article>
  `).join("");
}

function renderPortfolio() {
  const owned = allProperties().filter((item) => item.owned);
  const grouped = owned.reduce((acc, item) => {
    acc[item.type] ||= { count: 0, value: 0, profit: 0 };
    acc[item.type].count += 1;
    acc[item.type].value += item.marketValue;
    acc[item.type].profit += item.profit;
    return acc;
  }, {});
  document.getElementById("portfolioGrid").innerHTML = Object.entries(grouped).map(([type, data]) => `
    <article class="portfolio-card">
      <span>${type}</span>
      <strong>${data.count} ativo${data.count > 1 ? "s" : ""}</strong>
      <p>Valor atual: ${currency.format(data.value)}</p>
      <p>Lucro projetado: ${currency.format(data.profit)}</p>
    </article>
  `).join("") || `<article class="portfolio-card"><strong>Nenhum patrimonio cadastrado</strong><p>Marque oportunidades como arrematadas para montar a carteira.</p></article>`;
}

function renderSettings() {
  document.getElementById("connectorList").innerHTML = connectors.map((item) => `
    <article class="connector-item">
      <div><strong>${item.name}</strong><span>${item.kind}</span></div>
      <span class="tag">${item.enabled ? "Ativo" : "Inativo"}</span>
    </article>
  `).join("");
  const fields = [
    ["targetRoi", "ROI minimo desejado %", state.settings.targetRoi],
    ["maxLegalRisk", "Risco juridico maximo", state.settings.maxLegalRisk],
    ["minimumSafetyMargin", "Margem seguranca minima %", state.settings.minimumSafetyMargin],
    ["maxPayback", "Payback maximo meses", state.settings.maxPayback],
  ];
  document.getElementById("settingsForm").innerHTML = fields.map(([key, label, value]) => fieldHtml(key, label, value, "number")).join("");
  document.querySelectorAll("#settingsForm input").forEach((input) => {
    input.addEventListener("input", () => {
      state.settings[input.name] = Number(input.value || 0);
      saveState();
      renderDashboard();
      renderSearchRows(filterProperties());
    });
  });
}

function openDetail(id) {
  const item = allProperties().find((property) => property.id === id);
  if (!item) return;
  document.getElementById("detailTitle").textContent = `${item.city} - ${item.district}`;
  document.getElementById("detailContent").innerHTML = `
    <article class="detail-card"><span>Valor de mercado</span><strong>${currency.format(item.marketValue)}</strong></article>
    <article class="detail-card"><span>Leilao</span><strong>${currency.format(item.secondAuction)}</strong></article>
    <article class="detail-card"><span>Desconto</span><strong>${percent.format(item.discount)}</strong></article>
    <article class="detail-card"><span>Lucro esperado</span><strong>${currency.format(item.profit)}</strong></article>
    <article class="detail-card"><span>ROI</span><strong>${percent.format(item.roi)}</strong></article>
    <article class="detail-card"><span>Margem seguranca</span><strong>${percent.format(item.safetyMargin)}</strong></article>
    <article class="detail-card"><span>Risco juridico</span><strong>${(item.legalRisk / 10).toFixed(1)}</strong></article>
    <article class="detail-card"><span>Risco financeiro</span><strong>${(item.financialRisk / 10).toFixed(1)}</strong></article>
    <article class="detail-card full"><span>Recomendacao da IA</span><strong>${item.recommendation}</strong><p>${aiSummary(item)}</p></article>
    <article class="detail-card full"><span>Relatorio para socio</span><strong>PDF de investimento</strong><p>Gere um parecer executivo com numeros, riscos e recomendacao para envio ao investidor.</p><button class="primary-button" id="detailReport">Gerar PDF deste imovel</button></article>
  `;
  document.getElementById("detailDialog").showModal();
  document.getElementById("detailReport").addEventListener("click", () => downloadInvestorReport(item.id));
}

function analyzeLegalText() {
  const text = document.getElementById("legalText").value.toLowerCase();
  const checks = [
    ["alienacao fiduciaria", "Existe alienacao fiduciaria."],
    ["penhora", "Existe penhora registrada."],
    ["ocupado", "Ha risco de desocupacao judicial."],
    ["iptu quitado", "IPTU aparece como quitado."],
    ["condominio pendente", "Condominio pendente deve entrar no custo."],
    ["execucao fiscal", "Execucao fiscal exige validacao juridica."],
    ["indisponibilidade", "Indisponibilidade pode afetar registro."],
  ];
  const found = checks.filter(([term]) => text.includes(term));
  const risk = Math.min(100, 18 + found.length * 12);
  document.getElementById("riskTag").textContent = risk >= 70 ? "Risco alto" : risk >= 42 ? "Risco medio" : "Risco baixo";
  document.getElementById("legalResult").innerHTML = `
    <strong>Risco juridico: ${(risk / 10).toFixed(1)}</strong>
    <ul>
      ${(found.length ? found : [["", "Nenhum alerta critico encontrado no texto."]]).map(([, message]) => `<li>${message}</li>`).join("")}
      <li>Desconto ideal recomendado: ${Math.min(55, 28 + found.length * 4)}%.</li>
      <li>Validar edital, matricula atualizada e responsabilidade por debitos antes do lance.</li>
    </ul>
  `;
}

function aiResponse(question) {
  const best = allProperties()[0];
  const risky = allProperties().sort((a, b) => b.legalRisk - a.legalRisk)[0];
  const target = question.toLowerCase().includes("risco") ? risky : best;
  return `<strong>${target.city} - ${target.district}</strong>
    <ul>
      <li>Valor de mercado: ${currency.format(target.marketValue)}</li>
      <li>Valor do leilao: ${currency.format(target.secondAuction)}</li>
      <li>Desconto: ${percent.format(target.discount)}</li>
      <li>Lucro esperado: ${currency.format(target.profit)}</li>
      <li>ROI: ${percent.format(target.roi)}</li>
      <li>Risco juridico: ${(target.legalRisk / 10).toFixed(1)}</li>
      <li>Risco financeiro: ${(target.financialRisk / 10).toFixed(1)}</li>
      <li>Recomendacao: ${target.recommendation.toUpperCase()}</li>
    </ul>`;
}

function aiSummary(item) {
  const alerts = [];
  if (item.occupied) alerts.push("imovel ocupado");
  if (item.condoDebt > 0) alerts.push("condominio pendente");
  if (item.iptuDebt > 0) alerts.push("IPTU pendente");
  if (item.legalRisk > 45) alerts.push("risco juridico elevado");
  const alertText = alerts.length ? `Pontos de atencao: ${alerts.join(", ")}.` : "Sem alertas criticos simulados.";
  return `${alertText} A margem e o ROI indicam recomendacao ${item.recommendation}.`;
}

function reportPreviewHtml(item) {
  if (!item) return "";
  return `
    <article class="report-card">
      <strong>${item.city} - ${item.district}</strong>
      <span>${item.type} | ${item.source} | Leilao em ${dateBr(item.auctionDate)}</span>
      <div class="report-preview-grid">
        <div><span>Valor mercado</span><strong>${currency.format(item.marketValue)}</strong></div>
        <div><span>Leilao</span><strong>${currency.format(item.secondAuction)}</strong></div>
        <div><span>Lucro</span><strong>${currency.format(item.profit)}</strong></div>
        <div><span>ROI</span><strong>${percent.format(item.roi)}</strong></div>
        <div><span>Score</span><strong>${item.score}/100</strong></div>
        <div><span>Recomendacao</span><strong>${item.recommendation}</strong></div>
      </div>
      <p>${aiSummary(item)}</p>
    </article>
  `;
}

function investorReportLines(item) {
  return [
    "FIBONACCI INVEST",
    "Relatorio executivo para socio investidor",
    "",
    `Imovel: ${item.type} em ${item.city} - ${item.district}`,
    `Endereco/base: ${item.address || "Nao informado"}`,
    `Fonte: ${item.source} | Banco: ${item.bank} | Leiloeiro: ${item.auctioneer}`,
    `Data do leilao: ${dateBr(item.auctionDate)}`,
    "",
    "1. Resumo financeiro",
    `Valor de mercado estimado: ${currency.format(item.marketValue)}`,
    `Valor do leilao: ${currency.format(item.secondAuction)}`,
    `Desconto: ${percent.format(item.discount)}`,
    `Lance maximo recomendado: ${currency.format(item.maxBid)}`,
    `Custo total estimado: ${currency.format(item.totalCost)}`,
    `Lucro esperado: ${currency.format(item.profit)}`,
    `ROI projetado: ${percent.format(item.roi)}`,
    `Margem de seguranca: ${percent.format(item.safetyMargin)}`,
    "",
    "2. Custos considerados",
    `Reforma: ${currency.format(item.renovation)}`,
    `Desocupacao: ${currency.format(item.vacancy)}`,
    `Comissao: ${currency.format(item.commission)}`,
    `ITBI: ${currency.format(item.itbi)}`,
    `Registro: ${currency.format(item.registerCost)}`,
    `Condominio pendente: ${currency.format(item.condoDebt)}`,
    `IPTU pendente: ${currency.format(item.iptuDebt)}`,
    "",
    "3. Riscos",
    `Risco juridico: ${(item.legalRisk / 10).toFixed(1)} / 10`,
    `Risco financeiro: ${(item.financialRisk / 10).toFixed(1)} / 10`,
    `Imovel ocupado: ${item.occupied ? "Sim" : "Nao"}`,
    `Aceita financiamento: ${item.financing ? "Sim" : "Nao"}`,
    "",
    "4. Parecer da IA",
    aiSummary(item),
    "",
    `Score Fibonacci: ${item.score}/100`,
    `Recomendacao: ${item.recommendation.toUpperCase()}`,
    "",
    "5. Proximos passos",
    "Validar matricula atualizada, edital completo, debitos do imovel e estrategia de saida.",
    "Submeter documentos ao juridico antes de qualquer lance vinculante.",
    "",
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
  ];
}

function makeInvestorMessage(item) {
  return [
    `Fibonacci Invest - analise de oportunidade`,
    `${item.type} em ${item.city} - ${item.district}`,
    `Valor mercado: ${currency.format(item.marketValue)}`,
    `Leilao: ${currency.format(item.secondAuction)} (${percent.format(item.discount)} de desconto)`,
    `Lucro esperado: ${currency.format(item.profit)}`,
    `ROI: ${percent.format(item.roi)}`,
    `Score: ${item.score}/100`,
    `Recomendacao: ${item.recommendation.toUpperCase()}`,
    "",
    "Gerei o PDF com o parecer completo para avaliacao.",
  ].join("\n");
}

function selectedReportItem() {
  const mainViewActive = document.getElementById("reports")?.classList.contains("active-view");
  const id = mainViewActive ? document.getElementById("reportPropertyMain")?.value : document.getElementById("reportProperty")?.value;
  return allProperties().find((item) => item.id === id) || allProperties()[0];
}

function downloadInvestorReport(id = null) {
  const item = allProperties().find((property) => property.id === id) || selectedReportItem();
  if (!item) return;
  const { url, fileName } = buildReportBlobUrl(item);
  const mainViewActive = document.getElementById("reports")?.classList.contains("active-view");
  const targetId = mainViewActive ? "reportDownloadAreaMain" : "reportDownloadArea";
  const target = document.getElementById(targetId);
  if (target) {
    target.innerHTML = `
      <span class="success-note">Relatorio gerado. Clique no link abaixo para abrir ou baixar.</span>
      <a class="action-link" href="${url}" download="${fileName}" target="_blank">Abrir/Baixar PDF - ${fileName}</a>
    `;
  }
  state.history.unshift(`Relatorio PDF gerado para ${item.city} - ${item.district}.`);
  saveState();
  renderHistory();
}

function buildReportBlobUrl(item) {
  const lines = investorReportLines(item);
  const pdfBytes = createSimplePdf(lines);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  return {
    url: URL.createObjectURL(blob),
    fileName: `Relatorio_Fibonacci_${slug(item.city)}_${slug(item.district)}.pdf`,
    size: pdfBytes.length,
  };
}

function openWhatsappShare() {
  const item = selectedReportItem();
  const mainViewActive = document.getElementById("reports")?.classList.contains("active-view");
  const inputId = mainViewActive ? "investorWhatsappMain" : "investorWhatsapp";
  const rawPhone = document.getElementById(inputId).value.replace(/\D+/g, "");
  const phone = rawPhone ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`) : "";
  const text = encodeURIComponent(makeInvestorMessage(item));
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  const target = document.getElementById(mainViewActive ? "shareLinksMain" : "shareLinks");
  if (target) {
    target.innerHTML = `<a class="action-link" href="${url}" target="_blank">Abrir WhatsApp com mensagem pronta</a>`;
  }
}

function openEmailShare() {
  const item = selectedReportItem();
  const mainViewActive = document.getElementById("reports")?.classList.contains("active-view");
  const inputId = mainViewActive ? "investorEmailMain" : "investorEmail";
  const email = document.getElementById(inputId).value.trim();
  const subject = encodeURIComponent(`Relatorio Fibonacci Invest - ${item.city} ${item.district}`);
  const body = encodeURIComponent(`${makeInvestorMessage(item)}\n\nAnexo: baixe o PDF gerado pela ferramenta e envie junto neste e-mail.`);
  const target = document.getElementById(mainViewActive ? "shareLinksMain" : "shareLinks");
  if (target) {
    target.innerHTML = `<a class="action-link" href="mailto:${email}?subject=${subject}&body=${body}">Abrir e-mail com mensagem pronta</a>`;
  }
}

function createSimplePdf(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 52;
  const lineHeight = 15;
  const maxChars = 88;
  const pages = [];
  let page = [];
  for (const original of lines.flatMap((line) => wrapLine(line, maxChars))) {
    if (page.length >= Math.floor((pageHeight - margin * 2) / lineHeight)) {
      pages.push(page);
      page = [];
    }
    page.push(original);
  }
  if (page.length) pages.push(page);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];
  const contentIds = [];

  for (const pageLines of pages) {
    const textOps = ["BT", "/F1 10 Tf", `${margin} ${pageHeight - margin} Td`];
    pageLines.forEach((line, index) => {
      if (index > 0) textOps.push(`0 -${lineHeight} Td`);
      const escaped = escapePdfText(line);
      const bold = line === "FIBONACCI INVEST" || /^\d+\./.test(line);
      if (bold) textOps.push("/F1 13 Tf");
      textOps.push(`(${escaped}) Tj`);
      if (bold) textOps.push("/F1 10 Tf");
    });
    textOps.push("ET");
    const stream = textOps.join("\n");
    const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
  }

  const pagesIdPlaceholder = "__PAGES__";
  for (const contentId of contentIds) {
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const resolved = objects.map((body) => body.replaceAll(`${pagesIdPlaceholder} 0 R`, `${pagesId} 0 R`));
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  resolved.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${resolved.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${resolved.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function wrapLine(line, maxChars) {
  if (!line) return [""];
  const words = String(line).split(" ");
  const out = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      out.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) out.push(current);
  return out;
}

function escapePdfText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function slug(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

function fieldHtml(key, label, value, type = "text") {
  return `<div class="field"><label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" value="${value}" /></div>`;
}

function statusClass(label) {
  if (label === "Comprar") return "status-excellent";
  if (label === "Negociar") return "status-good";
  if (label === "Monitorar") return "status-watch";
  return "status-avoid";
}

function dateBr(value) {
  return value.split("-").reverse().join("/");
}

function buildPropertyForm() {
  const fields = [
    ["city", "Cidade", "Campinas", "text"],
    ["district", "Bairro", "Cambuí", "text"],
    ["bank", "Banco", "Caixa", "text"],
    ["auctioneer", "Leiloeiro", "Frazao", "text"],
    ["type", "Tipo", "Casa", "text"],
    ["marketValue", "Valor mercado", 700000, "number"],
    ["secondAuction", "Valor leilao", 360000, "number"],
    ["area", "Area m2", 90, "number"],
    ["garage", "Garagem", 2, "number"],
    ["auctionDate", "Data leilao", "2026-08-20", "date"],
  ];
  document.getElementById("propertyFields").innerHTML = fields.map(([key, label, value, type]) => fieldHtml(key, label, value, type)).join("");
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
      button.classList.add("active");
      document.getElementById(button.dataset.view).classList.add("active-view");
      document.getElementById("pageTitle").textContent = pageTitles[button.dataset.view];
    });
  });
  document.getElementById("runSearch").addEventListener("click", (event) => {
    event.preventDefault();
    state.history.unshift(`Pesquisa executada: ${state.searchFilters.city}, ${state.searchFilters.type}, ate ${currency.format(state.searchFilters.maxPrice)}.`);
    saveState();
    renderSearchRows(filterProperties());
    renderHistory();
  });
  document.getElementById("saveSearch").addEventListener("click", (event) => {
    event.preventDefault();
    state.savedSearches.push({ ...state.searchFilters, savedAt: new Date().toISOString() });
    state.history.unshift(`Filtro salvo para ${state.searchFilters.city} com desconto minimo de ${state.searchFilters.minDiscount}%.`);
    saveState();
    renderHistory();
  });
  document.getElementById("importXlsx").addEventListener("click", importXlsxFile);
  document.getElementById("downloadXlsxTemplate").addEventListener("click", downloadXlsxTemplate);
  document.getElementById("xlsxImport").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const status = document.getElementById("importStatus");
    status.textContent = file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado.";
    status.className = "import-status";
  });
  document.getElementById("askAi").addEventListener("click", () => {
    document.getElementById("aiAnswer").innerHTML = aiResponse(document.getElementById("aiPrompt").value || "melhor imovel");
  });
  document.getElementById("reportProperty").addEventListener("change", () => renderReportTools());
  document.getElementById("downloadReport").addEventListener("click", () => downloadInvestorReport());
  document.getElementById("sendWhatsapp").addEventListener("click", openWhatsappShare);
  document.getElementById("sendEmail").addEventListener("click", openEmailShare);
  document.getElementById("reportPropertyMain").addEventListener("change", () => renderMainReportTools());
  document.getElementById("downloadReportMain").addEventListener("click", () => downloadInvestorReport());
  document.getElementById("sendWhatsappMain").addEventListener("click", openWhatsappShare);
  document.getElementById("sendEmailMain").addEventListener("click", openEmailShare);
  document.querySelectorAll(".quick-question").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("aiPrompt").value = button.dataset.question;
      document.getElementById("aiAnswer").innerHTML = aiResponse(button.dataset.question);
    });
  });
  document.getElementById("loadLegalSample").addEventListener("click", () => {
    document.getElementById("legalText").value = "Edital informa alienacao fiduciaria, penhora, imovel ocupado, IPTU quitado e condominio pendente.";
    analyzeLegalText();
  });
  document.getElementById("analyzeLegal").addEventListener("click", analyzeLegalText);
  document.getElementById("openNewProperty").addEventListener("click", () => document.getElementById("propertyDialog").showModal());
  document.getElementById("closeDetail").addEventListener("click", () => document.getElementById("detailDialog").close());
  document.getElementById("saveProperty").addEventListener("click", (event) => {
    event.preventDefault();
    const values = Object.fromEntries([...document.querySelectorAll("#propertyForm input")].map((input) => [input.name, input.type === "number" ? Number(input.value || 0) : input.value]));
    state.properties.push({
      id: crypto.randomUUID(),
      state: "SP",
      source: values.auctioneer,
      firstAuction: Math.round(values.secondAuction * 1.28),
      maxBid: Math.round(values.marketValue * 0.72),
      renovation: Math.round(values.marketValue * 0.07),
      vacancy: 9000,
      commissionRate: 0.05,
      itbiRate: 0.03,
      registerCost: 4500,
      condoDebt: 0,
      iptuDebt: 0,
      financing: true,
      occupied: false,
      liquidity: 74,
      legalRisk: 26,
      saleMonths: 9,
      stage: "Prospeccao",
      owned: false,
      importedAt: "2026-06-25",
      ...values,
    });
    state.history.unshift(`Novo imovel cadastrado: ${values.city} - ${values.district}.`);
    saveState();
    document.getElementById("propertyDialog").close();
    render();
  });
  document.getElementById("resetData").addEventListener("click", () => {
    localStorage.removeItem("fibonacci-invest-platform");
    state = defaultState();
    saveState();
    render();
  });
}

buildPropertyForm();
bindEvents();
render();

window.FibonacciInvest = {
  reportStatus() {
    const item = selectedReportItem();
    const pdfBytes = createSimplePdf(investorReportLines(item));
    return {
      property: `${item.city} - ${item.district}`,
      bytes: pdfBytes.length,
      header: new TextDecoder().decode(pdfBytes.slice(0, 8)),
      message: makeInvestorMessage(item),
    };
  },
  async testXlsxImport() {
    const templateBytes = createTemplateXlsx();
    const file = new File([templateBytes], "modelo.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const rows = await readXlsxRows(file);
    const property = rowToProperty(rows[0]);
    return {
      templateSize: templateBytes.length,
      rows: rows.length,
      city: property?.city,
      district: property?.district,
      marketValue: property?.marketValue,
      secondAuction: property?.secondAuction,
    };
  },
  async previewXlsxImport(url) {
    const response = await fetch(url);
    const file = new File([await response.arrayBuffer()], "preview.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const rows = await readXlsxRows(file);
    const imported = rows.map(rowToProperty).filter(Boolean);
    return {
      rows: rows.length,
      imported: imported.length,
      first: imported[0] ? {
        city: imported[0].city,
        district: imported[0].district,
        type: imported[0].type,
        marketValue: imported[0].marketValue,
        secondAuction: imported[0].secondAuction,
        auctionDate: imported[0].auctionDate,
        sourceLink: imported[0].sourceLink,
      } : null,
    };
  },
};
