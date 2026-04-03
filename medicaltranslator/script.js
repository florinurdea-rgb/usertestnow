import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const elements = {
  fileInput: document.getElementById('file-input'),
  targetLanguage: document.getElementById('target-language'),
  analyzeBtn: document.getElementById('analyze-btn'),
  translateBtn: document.getElementById('translate-btn'),
  downloadBtn: document.getElementById('download-btn'),
  ingestionStatus: document.getElementById('ingestion-status'),
  translateStatus: document.getElementById('translate-status'),
  sourcePreview: document.getElementById('source-preview'),
  translatedPreview: document.getElementById('translated-preview')
};

const state = {
  sourceText: '',
  translatedText: '',
  sourceName: '',
  sourceType: '',
  analysisReady: false,
  docxHtml: '',
  pdfPages: []
};

const setStatus = (el, type, message) => {
  el.className = `status ${type}`;
  el.textContent = message;
};

const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

const sanitizeName = (filename) => filename.replace(/\.[^.]+$/, '');

const updateActionState = () => {
  const ready = Boolean(state.sourceText && elements.targetLanguage.value);
  elements.analyzeBtn.disabled = !ready;
  elements.translateBtn.disabled = !ready;
};

const translateSegments = async (segments, targetLanguage) => {
  const translated = [];
  for (const part of chunkArray(segments, 25)) {
    const response = await fetch('/api/medical-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'translate_segments',
        segments: part,
        targetLanguage
      })
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || 'Segment translation failed.');
    }
    const payload = await response.json();
    translated.push(...payload.translatedSegments);
  }
  return translated;
};

const readDocx = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await window.mammoth.convertToHtml({ arrayBuffer });
  const plain = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  state.docxHtml = value;
  state.sourceText = plain;
  state.sourceType = 'docx';
  elements.sourcePreview.innerHTML = value;
};

const readTextLike = async (file) => {
  const text = (await file.text()).trim();
  if (!text) throw new Error('The uploaded document appears to be empty.');
  state.sourceText = text;
  state.sourceType = 'text';
  elements.sourcePreview.textContent = text;
};

const renderPdfPagePreview = (container, pageHeight, items) => {
  const page = document.createElement('div');
  page.className = 'pdf-page';
  page.style.height = `${pageHeight}px`;

  for (const item of items) {
    const span = document.createElement('span');
    span.textContent = item.text;
    span.style.left = `${item.x}px`;
    span.style.top = `${pageHeight - item.y}px`;
    span.style.fontSize = `${item.fontSize}px`;
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    page.appendChild(span);
  }

  container.appendChild(page);
};

const readPdf = async (file) => {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  state.pdfPages = [];
  const allText = [];
  elements.sourcePreview.innerHTML = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.35 });
    const textContent = await page.getTextContent();

    const items = textContent.items.map((item) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      return {
        text: item.str,
        x: tx[4],
        y: tx[5],
        fontSize: Math.max(10, Math.abs(tx[0]))
      };
    }).filter((item) => item.text.trim());

    items.forEach((item) => allText.push(item.text));
    state.pdfPages.push({ width: viewport.width, height: viewport.height, items });
    renderPdfPagePreview(elements.sourcePreview, viewport.height, items);
  }

  state.sourceText = allText.join('\n');
  state.sourceType = 'pdf';
};

const ingestFile = async (file) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') return readDocx(file);
  if (ext === 'pdf') return readPdf(file);
  return readTextLike(file);
};

elements.targetLanguage.addEventListener('change', updateActionState);

elements.fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files || [];
  state.analysisReady = false;
  state.translatedText = '';
  state.sourceText = '';
  state.pdfPages = [];
  state.docxHtml = '';
  elements.translatedPreview.textContent = 'Translated output will appear here.';
  elements.downloadBtn.disabled = true;

  if (!file) {
    setStatus(elements.ingestionStatus, 'idle', 'Waiting for document upload.');
    updateActionState();
    return;
  }

  state.sourceName = sanitizeName(file.name);
  setStatus(elements.ingestionStatus, 'working', 'Ingesting and parsing document...');
  try {
    await ingestFile(file);
    setStatus(elements.ingestionStatus, 'done', 'Document uploaded and ready for analysis.');
    setStatus(elements.translateStatus, 'idle', 'Run analysis first or start full translation directly.');
    updateActionState();
  } catch (error) {
    setStatus(elements.ingestionStatus, 'error', error.message || 'Failed to read file.');
    updateActionState();
  }
});

elements.analyzeBtn.addEventListener('click', async () => {
  if (!state.sourceText || !elements.targetLanguage.value) return;
  setStatus(elements.translateStatus, 'working', 'Analyzing document word-by-word for medical context...');

  try {
    const response = await fetch('/api/medical-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'analyze',
        sourceText: state.sourceText,
        targetLanguage: elements.targetLanguage.value
      })
    });

    if (!response.ok) throw new Error('Analysis failed.');
    state.analysisReady = true;
    setStatus(elements.translateStatus, 'done', 'Analysis complete. You can now translate with full clinical context.');
  } catch (error) {
    setStatus(elements.translateStatus, 'error', error.message || 'Analysis failed. Please try again.');
  }
});

const translateDocxPreservingLayout = async () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = state.docxHtml;

  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.trim()) textNodes.push(node);
  }

  const translated = await translateSegments(textNodes.map((n) => n.nodeValue), elements.targetLanguage.value);
  translated.forEach((value, index) => {
    textNodes[index].nodeValue = value;
  });

  const html = wrapper.innerHTML;
  elements.translatedPreview.innerHTML = html;
  state.translatedText = wrapper.textContent || '';
};

const translatePdfPreservingLayout = async () => {
  const allItems = state.pdfPages.flatMap((p) => p.items);
  const translated = await translateSegments(allItems.map((i) => i.text), elements.targetLanguage.value);

  let idx = 0;
  const translatedPages = state.pdfPages.map((page) => {
    const items = page.items.map((item) => ({ ...item, text: translated[idx++] || item.text }));
    return { ...page, items };
  });

  elements.translatedPreview.innerHTML = '';
  translatedPages.forEach((page) => renderPdfPagePreview(elements.translatedPreview, page.height, page.items));
  state.translatedText = translated.join('\n');
  state.pdfPages = translatedPages;
};

elements.translateBtn.addEventListener('click', async () => {
  if (!state.sourceText || !elements.targetLanguage.value) return;
  setStatus(elements.translateStatus, 'working', `Translating into ${elements.targetLanguage.value} with medical-context preservation...`);

  try {
    if (state.sourceType === 'docx') {
      await translateDocxPreservingLayout();
    } else if (state.sourceType === 'pdf') {
      await translatePdfPreservingLayout();
    } else {
      const response = await fetch('/api/medical-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'translate',
          sourceText: state.sourceText,
          targetLanguage: elements.targetLanguage.value,
          analysisReady: state.analysisReady
        })
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || 'Translation request failed.');
      }
      const payload = await response.json();
      state.translatedText = payload.translatedText;
      elements.translatedPreview.textContent = payload.translatedText;
    }

    elements.downloadBtn.disabled = false;
    setStatus(elements.translateStatus, 'done', 'Translation complete. Preview updated and PDF download is enabled.');
  } catch (error) {
    setStatus(elements.translateStatus, 'error', error.message || 'Translation failed.');
  }
});

elements.downloadBtn.addEventListener('click', async () => {
  if (!state.translatedText) return;

  if (state.sourceType === 'pdf' && window.PDFLib) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    state.pdfPages.forEach((page) => {
      const p = pdfDoc.addPage([page.width, page.height]);
      page.items.forEach((item) => {
        p.drawText(item.text, {
          x: item.x,
          y: item.y,
          size: Math.max(9, item.fontSize),
          font,
          color: rgb(0.1, 0.1, 0.1)
        });
      });
    });

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.sourceName}-${elements.targetLanguage.value.toLowerCase()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) {
    setStatus(elements.translateStatus, 'error', 'PDF engine failed to load. Refresh and try again.');
    return;
  }

  const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const lines = doc.splitTextToSize(state.translatedText, width);
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Medical Doc Translator Output', margin, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  lines.forEach((line) => {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 14;
  });

  const filename = `${state.sourceName || 'translated-medical-document'}-${elements.targetLanguage.value.toLowerCase()}.pdf`;
  doc.save(filename);
});
