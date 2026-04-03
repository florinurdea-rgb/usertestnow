(() => {
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
    analysisReady: false
  };

  const setStatus = (el, type, message) => {
    el.className = `status ${type}`;
    el.textContent = message;
  };

  const readTextFile = async (file) => {
    const text = await file.text();
    return text.trim();
  };

  elements.fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    state.analysisReady = false;
    state.translatedText = '';
    elements.translatedPreview.textContent = 'Translated output will appear here.';
    elements.downloadBtn.disabled = true;

    if (!file) {
      setStatus(elements.ingestionStatus, 'idle', 'Waiting for document upload.');
      return;
    }

    setStatus(elements.ingestionStatus, 'working', 'Ingesting and parsing document...');
    try {
      const text = await readTextFile(file);
      if (!text) {
        throw new Error('The uploaded document appears to be empty.');
      }

      state.sourceText = text;
      state.sourceName = file.name.replace(/\.[^.]+$/, '');
      elements.sourcePreview.textContent = text;
      elements.analyzeBtn.disabled = false;
      elements.translateBtn.disabled = false;
      setStatus(elements.ingestionStatus, 'done', 'Document uploaded and ready for analysis.');
      setStatus(elements.translateStatus, 'idle', 'Run analysis first or start full translation directly.');
    } catch (error) {
      setStatus(elements.ingestionStatus, 'error', error.message || 'Failed to read file.');
      elements.analyzeBtn.disabled = true;
      elements.translateBtn.disabled = true;
    }
  });

  elements.analyzeBtn.addEventListener('click', async () => {
    if (!state.sourceText) return;
    setStatus(elements.translateStatus, 'working', 'Analyzing document word-by-word for medical context...');

    try {
      await fetch('/api/medical-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          sourceText: state.sourceText,
          targetLanguage: elements.targetLanguage.value
        })
      });

      state.analysisReady = true;
      setStatus(elements.translateStatus, 'done', 'Analysis complete. You can now translate with full clinical context.');
    } catch (error) {
      setStatus(elements.translateStatus, 'error', 'Analysis failed. Please try again.');
    }
  });

  elements.translateBtn.addEventListener('click', async () => {
    if (!state.sourceText) return;
    setStatus(elements.translateStatus, 'working', `Translating into ${elements.targetLanguage.value} with medical-context preservation...`);

    try {
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
      elements.downloadBtn.disabled = false;
      setStatus(elements.translateStatus, 'done', 'Translation complete. Preview updated and PDF download is enabled.');
    } catch (error) {
      setStatus(elements.translateStatus, 'error', error.message || 'Translation failed.');
    }
  });

  elements.downloadBtn.addEventListener('click', () => {
    if (!state.translatedText) return;
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
})();
