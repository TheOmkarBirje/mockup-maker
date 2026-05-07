import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function Generator({ basePath, mockups }) {
  const [selectedMockup, setSelectedMockup] = useState(mockups[0].id);
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [svgTemplate, setSvgTemplate] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [outputFormat, setOutputFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.8);
  const [includeOriginals, setIncludeOriginals] = useState(false);
  const fileInputRef = useRef(null);

  // Reset selected mockup when switching tabs (which changes the mockups prop)
  useEffect(() => {
    setSelectedMockup(mockups[0].id);
    setFiles([]);
    setSelectedIndex(0);
    setPreviewUrl('');
    setSvgTemplate('');
  }, [basePath, mockups]);

  // Load SVG Template on mount or when selected mockup changes
  useEffect(() => {
    if (!selectedMockup) return;
    fetch(`/${basePath}/${selectedMockup}`)
      .then((res) => res.text())
      .then((text) => setSvgTemplate(text))
      .catch((err) => console.error('Failed to load SVG template', err));
  }, [selectedMockup, basePath]);

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('active');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  // Convert File to Data URL
  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // Modify SVG for a given image
  const generateModifiedSvg = async (file) => {
    if (!svgTemplate) return null;
    
    const dataUrl = await fileToDataUrl(file);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgTemplate, 'image/svg+xml');
    
    const placeholder = doc.querySelector('#Placeholder-Image') || doc.querySelector('[id="Placeholder-Image"]');
    if (placeholder) {
      const image = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('id', 'Placeholder-Image');
      image.setAttribute('x', placeholder.getAttribute('x'));
      image.setAttribute('y', placeholder.getAttribute('y'));
      image.setAttribute('width', placeholder.getAttribute('width'));
      image.setAttribute('height', placeholder.getAttribute('height'));
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      placeholder.parentNode.replaceChild(image, placeholder);
    } else {
      console.error('Placeholder-Image not found in template');
    }
    
    // Hide the faint horizontal line artifact from Figma exports (at y=595)
    const bgRect = doc.querySelector('svg > rect');
    if (bgRect) {
      const bgColor = bgRect.getAttribute('fill');
      if (bgColor) {
        const coverRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        coverRect.setAttribute('x', '0');
        coverRect.setAttribute('y', '593');
        coverRect.setAttribute('width', '3589');
        coverRect.setAttribute('height', '4');
        coverRect.setAttribute('fill', bgColor);
        doc.documentElement.appendChild(coverRect);
      }
    }
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  };

  // Update Preview when files change or selected index changes
  useEffect(() => {
    if (files.length > 0 && svgTemplate && files[selectedIndex]) {
      setIsPreviewLoading(true);
      generateModifiedSvg(files[selectedIndex]).then(svgString => {
        if (svgString) {
          const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setIsPreviewLoading(false);
          return () => URL.revokeObjectURL(url);
        } else {
          setIsPreviewLoading(false);
        }
      }).catch((err) => {
        console.error('Error generating preview', err);
        setIsPreviewLoading(false);
      });
    } else {
      setPreviewUrl('');
    }
  }, [files, selectedIndex, svgTemplate]);

  // Convert SVG String to PNG Blob
  const generateMockupBlob = async (file) => {
    const svgString = await generateModifiedSvg(file);
    if (!svgString) return null;

    return new Promise((resolve) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 3589; // Original SVG width
        canvas.height = 3595; // Original SVG height
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((mockupBlob) => {
          URL.revokeObjectURL(url);
          resolve(mockupBlob);
        }, outputFormat, quality);
      };
      img.onerror = (e) => {
        console.error('Failed to load image into canvas:', e);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  const handleDownloadAll = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setProcessingCount(0);
    
    const zip = new JSZip();
    
    const extension = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    
    for (let i = 0; i < files.length; i++) {
      setProcessingCount(i + 1);
      const mockupBlob = await generateMockupBlob(files[i]);
      if (mockupBlob) {
        zip.file(`${i * 2 + 1}.${extension}`, mockupBlob);
      }
      
      if (includeOriginals) {
        zip.file(`${i * 2 + 2}.png`, files[i]);
      }
      
      setProgress(((i + 1) / files.length) * 100);
      // Small delay to let browser breathe and update UI
      await new Promise(r => setTimeout(r, 100));
    }
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'mockups.zip');
    } catch (error) {
      console.error("Error generating zip:", error);
    }
    
    setIsProcessing(false);
    setProgress(0);
  };

  return (
    <>
      <div className="mockup-chooser glass-panel animate-fade-in">
        <h3>Select Mockup Style</h3>
        <div className="mockup-buttons">
          {mockups.map((mockup) => (
            <button 
              key={mockup.id} 
              className={`mockup-btn ${selectedMockup === mockup.id ? 'active' : ''}`}
              onClick={() => setSelectedMockup(mockup.id)}
            >
              {mockup.name}
            </button>
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="glass-panel upload-section animate-fade-in">
          <div 
            className="dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="drop-icon">✨</span>
            <h3 className="drop-text">Drag & Drop images here</h3>
            <p className="drop-subtext">or click to browse</p>
            <input 
              type="file" 
              className="file-input" 
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple 
              accept="image/*"
            />
          </div>

          {files.length > 0 && (
            <>
              <div className="file-list">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`} 
                    className={`file-item animate-fade-in ${index === selectedIndex ? 'selected' : ''}`} 
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span className="file-name">{file.name}</span>
                    <button className="remove-btn" onClick={(e) => { 
                      e.stopPropagation(); 
                      removeFile(index); 
                      if (index === selectedIndex && files.length > 1) {
                        setSelectedIndex(Math.max(0, index - 1));
                      }
                    }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="settings-panel animate-fade-in">
                <div className="settings-group">
                  <label className="settings-label">Output Format</label>
                  <select 
                    className="settings-select" 
                    value={outputFormat} 
                    onChange={(e) => setOutputFormat(e.target.value)}
                  >
                    <option value="image/jpeg">JPEG (Compressed)</option>
                    <option value="image/png">PNG (Lossless)</option>
                  </select>
                </div>

                {outputFormat === 'image/jpeg' && (
                  <div className="settings-group">
                    <label className="settings-label">
                      Quality <span>{Math.round(quality * 100)}%</span>
                    </label>
                    <input 
                      type="range" 
                      className="settings-range" 
                      min="0.1" 
                      max="1.0" 
                      step="0.05" 
                      value={quality} 
                      onChange={(e) => setQuality(parseFloat(e.target.value))}
                    />
                  </div>
                )}

                <div className="settings-group">
                  <label className="settings-toggle">
                    <input 
                      type="checkbox" 
                      checked={includeOriginals} 
                      onChange={(e) => setIncludeOriginals(e.target.checked)} 
                    />
                    <div className="toggle-slider"></div>
                    <span className="toggle-text">Include original images in ZIP</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="glass-panel preview-section animate-fade-in">
          <div className="preview-container">
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Mockup Preview" className={`preview-image animate-fade-in ${isPreviewLoading ? 'loading' : ''}`} />
                {isPreviewLoading && <div className="preview-loader">✨</div>}
              </>
            ) : (
              <p className="empty-preview">Upload an image to see preview</p>
            )}
          </div>
          
          <div className="action-bar">
            <button 
              className="btn-primary" 
              disabled={files.length === 0 || isProcessing}
              onClick={handleDownloadAll}
            >
              <span className="btn-icon">↓</span>
              {isProcessing ? 'Generating...' : 'Download All'}
            </button>
            
            {isProcessing && (
              <>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="status-text">Processing {processingCount} of {files.length} ({Math.round(progress)}%)</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Generator;
