let song;
let fft;
let frequencyData = [];
let isRecording = false;
let playButton, exportButton, fileInput;
let canvasWidth = 2000;
let canvasHeight = 1500;
let fftSize = 1024;

// Dynamic frequency bands (3-8 bands)
let numBands = 3;
let frequencyBands = [
  { min: 20, max: 250, scale: 1.0, color: [0, 0, 255] },     // Blue
  { min: 250, max: 4000, scale: 1.0, color: [0, 255, 0] },   // Green  
  { min: 4000, max: 20000, scale: 1.0, color: [255, 0, 0] }  // Red
];
let samplingRate = 10;
let samplingCounter = 0;
let smoothingFrames = 3;
let smoothingBuffer = [];
let overlayMode = false;
let amplitudeNormalization = true;
let amplitudeStats = { low: [], mid: [], high: [] };

// GUI elements
let numBandsSlider, samplingSlider, smoothingSlider, overlayToggle, normalizationToggle;
let bandControls = [];
let guiPanel;

function preload() {
  song = loadSound('musicfiles/02 Break.m4a', loaded);
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  fft = new p5.FFT(0.8, fftSize);
  
  // Create main UI elements
  playButton = createButton("▶ Play & Record");
  playButton.mousePressed(togglePlayAndRecord);
  playButton.position(20, 20);
  playButton.style('padding', '12px 18px');
  playButton.style('font-size', '16px');
  
  exportButton = createButton("📄 Export SVG");
  exportButton.mousePressed(exportSVG);
  exportButton.position(200, 20);
  exportButton.style('padding', '12px 18px');
  exportButton.style('font-size', '16px');
  
  // File input for loading audio files
  fileInput = createFileInput(handleFile);
  fileInput.position(20, 70);
  fileInput.style('font-size', '14px');
  
  // Create GUI panel
  createGUIPanel();
  
  console.log("Setup complete");
  if (song) song.setVolume(0.3);
}

function createGUIPanel() {
  // Create GUI panel div
  guiPanel = createDiv('');
  guiPanel.position(canvasWidth + 30, 20);
  guiPanel.style('width', '400px');
  guiPanel.style('height', `${canvasHeight - 40}px`);
  guiPanel.style('background-color', '#f8f8f8');
  guiPanel.style('border', '2px solid #ddd');
  guiPanel.style('border-radius', '12px');
  guiPanel.style('padding', '20px');
  guiPanel.style('font-family', 'Arial, sans-serif');
  guiPanel.style('overflow-y', 'auto');
  guiPanel.style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)');
  
  // Number of bands control
  let title = createElement('h3', 'Frequency Band Controls');
  title.parent(guiPanel);
  title.style('margin', '0 0 20px 0');
  title.style('color', '#333');
  title.style('font-size', '18px');
  
  let bandsLabel = createElement('label', 'Number of Bands (3-8):');
  bandsLabel.parent(guiPanel);
  bandsLabel.style('display', 'block');
  bandsLabel.style('margin-bottom', '8px');
  bandsLabel.style('font-weight', 'bold');
  bandsLabel.style('font-size', '14px');
  
  numBandsSlider = createSlider(3, 8, numBands);
  numBandsSlider.parent(guiPanel);
  numBandsSlider.style('width', '100%');
  numBandsSlider.style('height', '20px');
  numBandsSlider.style('margin-bottom', '20px');
  numBandsSlider.input(updateBandCount);
  
  // Sampling rate control
  let samplingLabel = createElement('label', 'Sampling Rate (samples/sec):');
  samplingLabel.parent(guiPanel);
  samplingLabel.style('display', 'block');
  samplingLabel.style('margin-bottom', '8px');
  samplingLabel.style('font-weight', 'bold');
  samplingLabel.style('font-size', '14px');
  
  samplingSlider = createSlider(1, 60, samplingRate);
  samplingSlider.parent(guiPanel);
  samplingSlider.style('width', '100%');
  samplingSlider.style('height', '20px');
  samplingSlider.style('margin-bottom', '20px');
  
  // Smoothing control
  let smoothingLabel = createElement('label', 'Smoothing (frames):');
  smoothingLabel.parent(guiPanel);
  smoothingLabel.style('display', 'block');
  smoothingLabel.style('margin-bottom', '8px');
  smoothingLabel.style('font-weight', 'bold');
  smoothingLabel.style('font-size', '14px');
  
  smoothingSlider = createSlider(1, 10, smoothingFrames);
  smoothingSlider.parent(guiPanel);
  smoothingSlider.style('width', '100%');
  smoothingSlider.style('height', '20px');
  smoothingSlider.style('margin-bottom', '20px');
  
  // Overlay mode toggle
  overlayToggle = createCheckbox('Overlay all bands', overlayMode);
  overlayToggle.parent(guiPanel);
  overlayToggle.style('margin-bottom', '15px');
  overlayToggle.style('font-weight', 'bold');
  overlayToggle.style('font-size', '14px');
  
  // Normalization toggle
  normalizationToggle = createCheckbox('Normalize amplitude across bands', amplitudeNormalization);
  normalizationToggle.parent(guiPanel);
  normalizationToggle.style('margin-bottom', '30px');
  normalizationToggle.style('font-weight', 'bold');
  normalizationToggle.style('font-size', '14px');
  
  // Create initial band controls
  createBandControls();
}

function updateBandCount() {
  let newNumBands = numBandsSlider.value();
  if (newNumBands !== numBands) {
    numBands = newNumBands;
    updateFrequencyBands();
    recreateBandControls();
  }
}

function updateFrequencyBands() {
  // Generate evenly spaced frequency bands
  let colors = [
    [0, 0, 255],    // Blue
    [0, 255, 0],    // Green
    [255, 0, 0],    // Red
    [255, 165, 0],  // Orange
    [128, 0, 128],  // Purple
    [255, 192, 203], // Pink
    [0, 255, 255],  // Cyan
    [255, 255, 0]   // Yellow
  ];
  
  frequencyBands = [];
  let minFreq = 20;
  let maxFreq = 20000;
  let logMin = Math.log10(minFreq);
  let logMax = Math.log10(maxFreq);
  
  for (let i = 0; i < numBands; i++) {
    let logStart = logMin + (i / numBands) * (logMax - logMin);
    let logEnd = logMin + ((i + 1) / numBands) * (logMax - logMin);
    
    frequencyBands.push({
      min: Math.round(Math.pow(10, logStart)),
      max: Math.round(Math.pow(10, logEnd)),
      scale: 1.0,
      color: colors[i % colors.length]
    });
  }
}

function recreateBandControls() {
  // Remove existing band controls
  bandControls.forEach(control => {
    control.container.remove();
  });
  bandControls = [];
  
  // Create new band controls
  createBandControls();
}

function createBandControls() {
  bandControls = [];
  
  for (let i = 0; i < numBands; i++) {
    let container = createDiv('');
    container.parent(guiPanel);
    container.style('margin-bottom', '25px');
    container.style('padding', '15px');
    container.style('background-color', '#fff');
    container.style('border-radius', '8px');
    container.style('border', '2px solid #ddd');
    container.style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
    
    let bandLabel = createElement('h4', `Band ${i + 1}`);
    bandLabel.parent(container);
    bandLabel.style('margin', '0 0 15px 0');
    bandLabel.style('font-size', '16px');
    bandLabel.style('color', `rgb(${frequencyBands[i].color[0]}, ${frequencyBands[i].color[1]}, ${frequencyBands[i].color[2]})`);
    
    // Min frequency
    let minLabel = createElement('label', `Min: ${frequencyBands[i].min}Hz`);
    minLabel.parent(container);
    minLabel.style('display', 'block');
    minLabel.style('font-size', '13px');
    minLabel.style('margin-bottom', '5px');
    minLabel.style('font-weight', 'bold');
    
    let minSlider = createSlider(20, 19999, frequencyBands[i].min);
    minSlider.parent(container);
    minSlider.style('width', '100%');
    minSlider.style('height', '18px');
    minSlider.style('margin-bottom', '15px');
    
    // Max frequency
    let maxLabel = createElement('label', `Max: ${frequencyBands[i].max}Hz`);
    maxLabel.parent(container);
    maxLabel.style('display', 'block');
    maxLabel.style('font-size', '13px');
    maxLabel.style('margin-bottom', '5px');
    maxLabel.style('font-weight', 'bold');
    
    let maxSlider = createSlider(21, 20000, frequencyBands[i].max);
    maxSlider.parent(container);
    maxSlider.style('width', '100%');
    maxSlider.style('height', '18px');
    maxSlider.style('margin-bottom', '15px');
    
    // Amplitude scale
    let scaleLabel = createElement('label', `Amplitude Scale: ${frequencyBands[i].scale.toFixed(1)}x`);
    scaleLabel.parent(container);
    scaleLabel.style('display', 'block');
    scaleLabel.style('font-size', '13px');
    scaleLabel.style('margin-bottom', '5px');
    scaleLabel.style('font-weight', 'bold');
    
    let scaleSlider = createSlider(0.1, 5.0, frequencyBands[i].scale, 0.1);
    scaleSlider.parent(container);
    scaleSlider.style('width', '100%');
    scaleSlider.style('height', '18px');
    
    bandControls.push({
      container,
      minSlider,
      maxSlider,
      scaleSlider,
      minLabel,
      maxLabel,
      scaleLabel
    });
  }
}

function loaded() {
  console.log("Song loaded");
  if (song) song.setVolume(0.3);
}

function handleFile(file) {
  if (file.type === 'audio') {
    song = loadSound(file.data, loaded);
    frequencyData = [];
    smoothingBuffer = [];
    console.log("New audio file loaded");
  }
}

function draw() {
  background(255);
  
  // Update frequency band settings from sliders
  updateBandSettings();
  
  // Update settings
  smoothingFrames = smoothingSlider.value();
  overlayMode = overlayToggle.checked();
  amplitudeNormalization = normalizationToggle.checked();
  
  // Record frequency data while playing (with sampling rate control)
  if (song && song.isPlaying() && isRecording) {
    samplingCounter++;
    if (samplingCounter >= 60 / samplingSlider.value()) {
      let spectrum = fft.analyze();
      let dataPoint = analyzeFrequencyBands(spectrum);
      
      // Apply smoothing
      if (smoothingFrames > 1) {
        dataPoint = applySmoothing(dataPoint);
      }
      
      // Apply normalization if enabled
      if (amplitudeNormalization) {
        dataPoint = normalizeAmplitudes(dataPoint);
      }
      
      frequencyData.push(dataPoint);
      samplingCounter = 0;
    }
  }
  
  // Stop recording when song ends to ensure full duration
  if (song && !song.isPlaying() && isRecording && song.currentTime() >= song.duration() - 0.1) {
    isRecording = false;
    playButton.html("▶ Play & Record");
    console.log("Recording completed - full song captured");
  }
  
  // Draw the frequency lines
  drawFrequencyLines();
  
  // Draw UI info
  drawUI();
}

function updateBandSettings() {
  // Update frequency band settings from GUI controls
  for (let i = 0; i < bandControls.length && i < frequencyBands.length; i++) {
    let control = bandControls[i];
    let band = frequencyBands[i];
    
    // Get values from sliders
    let newMin = control.minSlider.value();
    let newMax = control.maxSlider.value();
    let newScale = control.scaleSlider.value();
    
    // Ensure min < max and no overlap with adjacent bands
    if (newMin >= newMax) {
      newMin = newMax - 1;
      control.minSlider.value(newMin);
    }
    
    // Prevent overlap with previous band
    if (i > 0 && newMin <= frequencyBands[i-1].max) {
      newMin = frequencyBands[i-1].max + 1;
      control.minSlider.value(newMin);
    }
    
    // Prevent overlap with next band
    if (i < frequencyBands.length - 1 && newMax >= frequencyBands[i+1].min) {
      newMax = frequencyBands[i+1].min - 1;
      control.maxSlider.value(newMax);
    }
    
    // Update band settings
    band.min = newMin;
    band.max = newMax;
    band.scale = newScale;
    
    // Update labels
    control.minLabel.html(`Min: ${newMin}Hz`);
    control.maxLabel.html(`Max: ${newMax}Hz`);
    control.scaleLabel.html(`Amplitude Scale: ${newScale.toFixed(1)}x`);
  }
}

function analyzeFrequencyBands(spectrum) {
  let nyquist = 22050;
  let binSize = nyquist / spectrum.length;
  // Use elapsed time based on data points rather than song.currentTime() for accuracy
  let elapsedTime = frequencyData.length / samplingSlider.value();
  let dataPoint = { time: elapsedTime, bands: [] };
  
  for (let i = 0; i < frequencyBands.length; i++) {
    let band = frequencyBands[i];
    let sum = 0;
    let count = 0;
    
    for (let j = 0; j < spectrum.length; j++) {
      let freq = j * binSize;
      let amplitude = spectrum[j];
      
      if (freq >= band.min && freq <= band.max) {
        sum += amplitude;
        count++;
      }
    }
    
    let avgAmplitude = count > 0 ? (sum / count) * band.scale : 0;
    dataPoint.bands.push(avgAmplitude);
  }
  
  return dataPoint;
}

function applySmoothing(newDataPoint) {
  // Add new data point to buffer
  smoothingBuffer.push(newDataPoint);
  
  // Keep buffer size limited to smoothingFrames
  if (smoothingBuffer.length > smoothingFrames) {
    smoothingBuffer.shift();
  }
  
  // If we don't have enough frames yet, return the new point
  if (smoothingBuffer.length < smoothingFrames) {
    return newDataPoint;
  }
  
  // Calculate averaged data point
  let smoothedPoint = { time: newDataPoint.time, bands: [] };
  
  for (let bandIndex = 0; bandIndex < newDataPoint.bands.length; bandIndex++) {
    let sum = 0;
    for (let frameIndex = 0; frameIndex < smoothingBuffer.length; frameIndex++) {
      sum += smoothingBuffer[frameIndex].bands[bandIndex];
    }
    smoothedPoint.bands.push(sum / smoothingBuffer.length);
  }
  
  return smoothedPoint;
}

function normalizeAmplitudes(dataPoint) {
  if (!amplitudeNormalization || dataPoint.bands.length === 0) {
    return dataPoint;
  }
  
  // Calculate statistics for normalization
  let maxAmplitude = Math.max(...dataPoint.bands);
  let minAmplitude = Math.min(...dataPoint.bands);
  let range = maxAmplitude - minAmplitude;
  
  if (range === 0) return dataPoint;
  
  // Normalize each band to 0-255 range based on relative differences
  let normalizedPoint = { time: dataPoint.time, bands: [] };
  
  for (let i = 0; i < dataPoint.bands.length; i++) {
    // Apply frequency-specific weighting to compensate for natural amplitude differences
    let frequencyWeight = getFrequencyWeight(i);
    let weightedAmplitude = dataPoint.bands[i] * frequencyWeight;
    
    // Normalize to 0-255 range
    let normalized = map(weightedAmplitude, 0, 255 * frequencyWeight, 0, 255);
    normalized = constrain(normalized, 0, 255);
    
    normalizedPoint.bands.push(normalized);
  }
  
  return normalizedPoint;
}

function getFrequencyWeight(bandIndex) {
  // Apply weights to compensate for natural frequency response differences
  // Low frequencies typically have higher natural amplitude
  let band = frequencyBands[bandIndex];
  let centerFreq = (band.min + band.max) / 2;
  
  if (centerFreq < 500) {
    return 0.3; // Reduce low frequency dominance
  } else if (centerFreq < 2000) {
    return 0.7; // Slightly reduce mid frequencies
  } else if (centerFreq < 8000) {
    return 1.0; // Keep mid-high frequencies as-is
  } else {
    return 1.5; // Boost high frequencies
  }
}

function drawFrequencyLines() {
  if (frequencyData.length === 0) return;
  
  let margin = 80;
  let plotWidth = width - 2 * margin;
  
  if (overlayMode) {
    drawOverlayMode(margin, plotWidth);
  } else {
    drawSeparateBands(margin, plotWidth);
  }
}

function drawSeparateBands(margin, plotWidth) {
  let plotHeight = (height - 2 * margin - 120) / numBands;
  
  // Draw axes and grid
  stroke(0);
  strokeWeight(3);
  line(margin, height - margin, width - margin, height - margin); // X-axis
  line(margin, margin, margin, height - margin); // Y-axis
  
  // Draw time labels
  drawTimeLabels(margin);
  
  // Draw amplitude labels and sections for each band
  textAlign(RIGHT, CENTER);
  textSize(14);
  
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let sectionY = margin + bandIndex * plotHeight;
    let band = frequencyBands[bandIndex];
    
    // Section label
    fill(0);
    text(`${band.min}-${band.max}Hz`, margin - 10, sectionY + plotHeight / 2);
    
    // Grid lines
    stroke(200);
    strokeWeight(0.5);
    line(margin, sectionY, width - margin, sectionY);
    if (bandIndex === numBands - 1) {
      line(margin, sectionY + plotHeight, width - margin, sectionY + plotHeight);
    }
    
    // Draw frequency line
    if (frequencyData.length > 1) {
      stroke(band.color[0], band.color[1], band.color[2]);
      strokeWeight(3);
      noFill();
      
      beginShape();
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, width - margin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, sectionY + plotHeight, sectionY);
        vertex(x, y);
      }
      endShape();
    }
  }
}

function drawOverlayMode(margin, plotWidth) {
  let plotHeight = height - 2 * margin - 120;
  
  // Draw axes and grid
  stroke(0);
  strokeWeight(3);
  line(margin, height - margin, width - margin, height - margin); // X-axis
  line(margin, margin, margin, height - margin); // Y-axis
  
  // Draw time labels
  drawTimeLabels(margin);
  
  // Draw amplitude grid lines
  stroke(200);
  strokeWeight(1);
  for (let i = 0; i <= 10; i++) {
    let y = map(i, 0, 10, height - margin, margin);
    line(margin, y, width - margin, y);
  }
  
  // Draw amplitude labels
  textAlign(RIGHT, CENTER);
  textSize(14);
  fill(0);
  for (let i = 0; i <= 10; i++) {
    let y = map(i, 0, 10, height - margin, margin);
    let amplitude = map(i, 0, 10, 0, 255);
    text(Math.round(amplitude), margin - 15, y);
  }
  
  // Draw legend
  drawLegend(margin);
  
  // Draw all frequency lines overlaid
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let band = frequencyBands[bandIndex];
      stroke(band.color[0], band.color[1], band.color[2]);
      strokeWeight(3);
      noFill();
      
      beginShape();
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, width - margin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, height - margin, margin);
        vertex(x, y);
      }
      endShape();
    }
  }
}

function drawTimeLabels(margin) {
  textAlign(CENTER, TOP);
  textSize(16);
  fill(0);
  let maxTime = frequencyData.length > 0 ? 
    frequencyData[frequencyData.length - 1].time : 
    (song ? song.duration() : 0);
  
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, maxTime);
    let x = map(i, 0, 10, margin, width - margin);
    text(time.toFixed(1) + "s", x, height - margin + 15);
    
    stroke(200);
    strokeWeight(1);
    line(x, margin, x, height - margin);
  }
}

function drawLegend(margin) {
  // Draw legend in top right
  let legendX = width - margin - 200;
  let legendY = margin + 30;
  
  textAlign(LEFT, CENTER);
  textSize(14);
  
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    let y = legendY + i * 20;
    
    // Color line
    stroke(band.color[0], band.color[1], band.color[2]);
    strokeWeight(4);
    line(legendX, y, legendX + 30, y);
    
    // Label
    fill(0);
    noStroke();
    text(`${band.min}-${band.max}Hz`, legendX + 40, y);
  }
}

function drawUI() {
  fill(0);
  textAlign(LEFT, TOP);
  textSize(16);
  
  let info = [];
  if (song) {
    info.push(`Duration: ${song.duration().toFixed(1)}s`);
    // Show estimated time based on data points for accuracy
    let estimatedTime = frequencyData.length / samplingSlider.value();
    info.push(`Recorded time: ${estimatedTime.toFixed(1)}s`);
  }
  info.push(`Recording: ${isRecording ? 'ON' : 'OFF'}`);
  info.push(`Data points: ${frequencyData.length}`);
  info.push(`Bands: ${numBands}`);
  info.push(`Smoothing: ${smoothingFrames} frames`);
  info.push(`Mode: ${overlayMode ? 'Overlay' : 'Separate'}`);
  info.push(`Normalization: ${amplitudeNormalization ? 'ON' : 'OFF'}`);
  
  for (let i = 0; i < info.length; i++) {
    text(info[i], 20, 120 + i * 20);
  }
}

function mousePressed() {
  userStartAudio();
}

function togglePlayAndRecord() {
  if (!song) {
    console.log("No song loaded");
    return;
  }
  
  if (!song.isPlaying()) {
    frequencyData = [];
    samplingCounter = 0;
    smoothingBuffer = []; // Reset smoothing buffer
    amplitudeStats = { low: [], mid: [], high: [] }; // Reset normalization stats
    isRecording = true;
    song.play();
    
    // Set up automatic stop when song ends
    song.onended(() => {
      isRecording = false;
      playButton.html("▶ Play & Record");
      console.log("Recording completed - full song captured");
    });
    
    playButton.html("⏸ Stop & Pause");
    console.log("Started playing and recording");
  } else {
    isRecording = false;
    song.stop(); // Use stop instead of pause to reset position
    playButton.html("▶ Play & Record");
    console.log("Stopped recording");
  }
}

function exportSVG() {
  if (frequencyData.length === 0) {
    console.log("No data to export");
    return;
  }
  
  let svgContent = generateFrequencyLinesSVG();
  let blob = new Blob([svgContent], { type: "image/svg+xml" });
  
  // Create download link
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'frequency-lines.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("SVG exported");
}

function generateFrequencyLinesSVG() {
  let margin = 80;
  let plotWidth = canvasWidth - 2 * margin;
  let plotHeight = (canvasHeight - 2 * margin - 80) / numBands;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .axis { stroke: black; stroke-width: 2; }
    .grid { stroke: #cccccc; stroke-width: 0.5; }
    .label { font-family: Arial, sans-serif; font-size: 10px; fill: black; }`;
  
  // Generate CSS classes for each band
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    svg += `
    .band-${i} { stroke: rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]}); stroke-width: 2; fill: none; }`;
  }
  
  svg += `
  </style>
  
  <!-- Background -->
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
  
  <!-- Axes -->
  <line x1="${margin}" y1="${canvasHeight - margin}" x2="${canvasWidth - margin}" y2="${canvasHeight - margin}" class="axis"/>
  <line x1="${margin}" y1="${margin}" x2="${margin}" y2="${canvasHeight - margin}" class="axis"/>
  
  <!-- Time labels and grid -->`;
  
  let duration = song ? song.duration() : 0;
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, duration);
    let x = map(i, 0, 10, margin, canvasWidth - margin);
    svg += `
  <line x1="${x}" y1="${margin}" x2="${x}" y2="${canvasHeight - margin}" class="grid"/>
  <text x="${x}" y="${canvasHeight - margin + 20}" text-anchor="middle" class="label">${time.toFixed(1)}s</text>`;
  }
  
  // Section labels and grid lines for each band
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let sectionY = margin + bandIndex * plotHeight;
    let band = frequencyBands[bandIndex];
    svg += `
  <line x1="${margin}" y1="${sectionY}" x2="${canvasWidth - margin}" y2="${sectionY}" class="grid"/>`;
    if (bandIndex === numBands - 1) {
      svg += `
  <line x1="${margin}" y1="${sectionY + plotHeight}" x2="${canvasWidth - margin}" y2="${sectionY + plotHeight}" class="grid"/>`;
    }
    svg += `
  <text x="${margin - 10}" y="${sectionY + plotHeight / 2}" text-anchor="end" class="label">${band.min}-${band.max}Hz</text>`;
  }
  
  // Frequency lines
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let sectionY = margin + bandIndex * plotHeight;
      svg += `
  <polyline class="band-${bandIndex}" points="`;
      
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, canvasWidth - margin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, sectionY + plotHeight, sectionY);
        svg += `${x},${y} `;
      }
      
      svg += `"/>`;
    }
  }
  
  svg += `
</svg>`;
  
  return svg;
}