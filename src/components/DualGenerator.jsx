import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function DualGenerator() {
  const [desktopFiles, setDesktopFiles] = useState([]);
  const [phoneFiles, setPhoneFiles] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [svgTemplate, setSvgTemplate] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [outputFormat, setOutputFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.8);
  
  const desktopInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Load SVG Template for Combined Mockup
  useEffect(() => {
    fetch('/COMBINED/Mockup-3.svg')
      .then((res) => res.text())
      .then((text) => setSvgTemplate(text))
      .catch((err) => console.error('Failed to load SVG template', err));
  }, []);

  // Matching logic
  useEffect(() => {
    const pairs = [];
    desktopFiles.forEach(dFile => {
      const pFile = phoneFiles.find(p => p.name === dFile.name);
      if (pFile) {
        pairs.push({
          name: dFile.name,
          desktop: dFile,
          phone: pFile
        });
      }
    });
    setMatchedPairs(pairs);
    if (pairs.length > 0 && selectedIndex >= pairs.length) {
      setSelectedIndex(0);
    }
  }, [desktopFiles, phoneFiles]);

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      if (type === 'desktop') {
        setDesktopFiles(prev => [...prev, ...newFiles]);
      } else {
        setPhoneFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (name, type) => {
    if (type === 'desktop') {
      setDesktopFiles(prev => prev.filter(f => f.name !== name));
    } else {
      setPhoneFiles(prev => prev.filter(f => f.name !== name));
    }
  };

  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const generateModifiedSvg = async (pair) => {
    if (!svgTemplate || !pair) return null;
    
    const dDataUrl = await fileToDataUrl(pair.desktop);
    const pDataUrl = await fileToDataUrl(pair.phone);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgTemplate, 'image/svg+xml');
    
    // Replace Phone Placeholder
    const phonePlaceholder = doc.querySelector('#Phone-Placeholder-Image');
    if (phonePlaceholder) {
      const image = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('id', 'Phone-Placeholder-Image');
      image.setAttribute('x', phonePlaceholder.getAttribute('x'));
      image.setAttribute('y', phonePlaceholder.getAttribute('y'));
      image.setAttribute('width', phonePlaceholder.getAttribute('width'));
      image.setAttribute('height', phonePlaceholder.getAttribute('height'));
      image.setAttribute('rx', phonePlaceholder.getAttribute('rx') || '0');
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pDataUrl);
      phonePlaceholder.parentNode.replaceChild(image, phonePlaceholder);
    }

    // Replace Desktop Placeholder
    const desktopPlaceholder = doc.querySelector('#Desktop-Placeholder-Image');
    if (desktopPlaceholder) {
      const image = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('id', 'Desktop-Placeholder-Image');
      image.setAttribute('x', desktopPlaceholder.getAttribute('x'));
      image.setAttribute('y', desktopPlaceholder.getAttribute('y'));
      image.setAttribute('width', desktopPlaceholder.getAttribute('width'));
      image.setAttribute('height', desktopPlaceholder.getAttribute('height'));
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dDataUrl);
      desktopPlaceholder.parentNode.replaceChild(image, desktopPlaceholder);
    }
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  };

  useEffect(() => {
    if (matchedPairs.length > 0 && svgTemplate && matchedPairs[selectedIndex]) {
      setIsPreviewLoading(true);
      generateModifiedSvg(matchedPairs[selectedIndex]).then(svgString => {
        if (svgString) {
          const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setIsPreviewLoading(false);
          return () => URL.revokeObjectURL(url);
        } else {
          setIsPreviewLoading(false);
        }
      });
    } else {
      setPreviewUrl('');
    }
  }, [matchedPairs, selectedIndex, svgTemplate]);

  const generateMockupBlob = async (pair) => {
    const svgString = await generateModifiedSvg(pair);
    if (!svgString) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 3589;
        canvas.height = 3595;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), outputFormat, quality);
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    });
  };

  const handleDownloadAll = async () => {
    if (matchedPairs.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setProcessingCount(0);
    
    const zip = new JSZip();
    const extension = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    
    for (let i = 0; i < matchedPairs.length; i++) {
      setProcessingCount(i + 1);
      const blob = await generateMockupBlob(matchedPairs[i]);
      if (blob) {
        zip.file(`${matchedPairs[i].name.split('.')[0]}.${extension}`, blob);
      }
      setProgress(((i + 1) / matchedPairs.length) * 100);
      await new Promise(r => setTimeout(r, 100));
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'combined_mockups.zip');
    
    setIsProcessing(false);
    setProgress(0);
  };

  return (
    <div className="dual-generator animate-fade-in">
      <div className="glass-panel dual-upload-grid">
        <div className="upload-zone desktop">
          <h4>Desktop Screenshots</h4>
          <div className="dropzone compact" onClick={() => desktopInputRef.current.click()}>
            <span className="drop-icon">🖥️</span>
            <p>Upload Desktop</p>
            <input 
              type="file" 
              ref={desktopInputRef} 
              onChange={(e) => handleFileChange(e, 'desktop')} 
              multiple 
              accept="image/*" 
              hidden 
            />
          </div>
          <div className="mini-file-list">
            {desktopFiles.map(f => (
              <div key={f.name} className="mini-file-item">
                <span>{f.name}</span>
                <button onClick={() => removeFile(f.name, 'desktop')}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="upload-zone phone">
          <h4>Phone Screenshots</h4>
          <div className="dropzone compact" onClick={() => phoneInputRef.current.click()}>
            <span className="drop-icon">📱</span>
            <p>Upload Phone</p>
            <input 
              type="file" 
              ref={phoneInputRef} 
              onChange={(e) => handleFileChange(e, 'phone')} 
              multiple 
              accept="image/*" 
              hidden 
            />
          </div>
          <div className="mini-file-list">
            {phoneFiles.map(f => (
              <div key={f.name} className="mini-file-item">
                <span>{f.name}</span>
                <button onClick={() => removeFile(f.name, 'phone')}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="glass-panel matching-section">
          <h3>Matched Pairs ({matchedPairs.length})</h3>
          {matchedPairs.length > 0 ? (
            <div className="file-list">
              {matchedPairs.map((pair, index) => (
                <div 
                  key={pair.name} 
                  className={`file-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <span className="file-name">✨ {pair.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-msg">Upload images with same names to match them automatically.</p>
          )}

          <div className="settings-panel">
            <div className="settings-group">
              <label>Format</label>
              <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
              </select>
            </div>
            {outputFormat === 'image/jpeg' && (
              <div className="settings-group">
                <label>Quality {Math.round(quality * 100)}%</label>
                <input 
                  type="range" 
                  min="0.1" max="1" step="0.05" 
                  value={quality} 
                  onChange={(e) => setQuality(parseFloat(e.target.value))} 
                />
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel preview-section">
          <div className="preview-container">
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className={`preview-image ${isPreviewLoading ? 'loading' : ''}`} />
                {isPreviewLoading && <div className="preview-loader">✨</div>}
              </>
            ) : (
              <p className="empty-preview">Upload matching pairs to see preview</p>
            )}
          </div>
          
          <div className="action-bar">
            <button 
              className="btn-primary" 
              disabled={matchedPairs.length === 0 || isProcessing}
              onClick={handleDownloadAll}
            >
              {isProcessing ? 'Processing...' : 'Download All Matched'}
            </button>
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                <span>{processingCount} / {matchedPairs.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DualGenerator;
