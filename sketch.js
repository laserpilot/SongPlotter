let song;
let fft;
let frequencyData = [];
let isRecording = false;
let playButton, exportButton, fileInput;
let canvasWidth = 1200;
let canvasHeight = 800;
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

// GUI elements
let numBandsSlider, samplingSlider;
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
  playButton.position(10, 10);
  playButton.style('padding', '8px 12px');
  playButton.style('font-size', '14px');
  
  exportButton = createButton("📄 Export SVG");
  exportButton.mousePressed(exportSVG);
  exportButton.position(160, 10);
  exportButton.style('padding', '8px 12px');
  exportButton.style('font-size', '14px');
  
  // File input for loading audio files
  fileInput = createFileInput(handleFile);
  fileInput.position(10, 50);
  fileInput.style('font-size', '12px');
  
  // Create GUI panel
  createGUIPanel();
  
  console.log("Setup complete");
  if (song) song.setVolume(0.3);
}

function createGUIPanel() {
  // Create GUI panel div
  guiPanel = createDiv('');
  guiPanel.position(canvasWidth + 20, 10);
  guiPanel.style('width', '320px');
  guiPanel.style('height', `${canvasHeight - 20}px`);
  guiPanel.style('background-color', '#f8f8f8');
  guiPanel.style('border', '2px solid #ddd');
  guiPanel.style('border-radius', '8px');
  guiPanel.style('padding', '15px');
  guiPanel.style('font-family', 'Arial, sans-serif');
  guiPanel.style('overflow-y', 'auto');
  
  // Number of bands control
  let title = createElement('h3', 'Frequency Band Controls');
  title.parent(guiPanel);
  title.style('margin', '0 0 15px 0');
  title.style('color', '#333');
  
  let bandsLabel = createElement('label', 'Number of Bands (3-8):');
  bandsLabel.parent(guiPanel);
  bandsLabel.style('display', 'block');
  bandsLabel.style('margin-bottom', '5px');
  bandsLabel.style('font-weight', 'bold');
  
  numBandsSlider = createSlider(3, 8, numBands);
  numBandsSlider.parent(guiPanel);
  numBandsSlider.style('width', '100%');
  numBandsSlider.style('margin-bottom', '20px');
  numBandsSlider.input(updateBandCount);
  
  // Sampling rate control
  let samplingLabel = createElement('label', 'Sampling Rate (samples/sec):');
  samplingLabel.parent(guiPanel);
  samplingLabel.style('display', 'block');
  samplingLabel.style('margin-bottom', '5px');
  samplingLabel.style('font-weight', 'bold');
  
  samplingSlider = createSlider(1, 60, samplingRate);
  samplingSlider.parent(guiPanel);
  samplingSlider.style('width', '100%');
  samplingSlider.style('margin-bottom', '25px');
  
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
    container.style('margin-bottom', '20px');
    container.style('padding', '10px');
    container.style('background-color', '#fff');
    container.style('border-radius', '5px');
    container.style('border', '1px solid #ccc');
    
    let bandLabel = createElement('h4', `Band ${i + 1}`);
    bandLabel.parent(container);
    bandLabel.style('margin', '0 0 10px 0');
    bandLabel.style('color', `rgb(${frequencyBands[i].color[0]}, ${frequencyBands[i].color[1]}, ${frequencyBands[i].color[2]})`);
    
    // Min frequency
    let minLabel = createElement('label', `Min: ${frequencyBands[i].min}Hz`);
    minLabel.parent(container);
    minLabel.style('display', 'block');
    minLabel.style('font-size', '12px');
    minLabel.style('margin-bottom', '3px');
    
    let minSlider = createSlider(20, 19999, frequencyBands[i].min);
    minSlider.parent(container);
    minSlider.style('width', '100%');
    minSlider.style('margin-bottom', '10px');
    
    // Max frequency
    let maxLabel = createElement('label', `Max: ${frequencyBands[i].max}Hz`);
    maxLabel.parent(container);
    maxLabel.style('display', 'block');
    maxLabel.style('font-size', '12px');
    maxLabel.style('margin-bottom', '3px');
    
    let maxSlider = createSlider(21, 20000, frequencyBands[i].max);
    maxSlider.parent(container);
    maxSlider.style('width', '100%');
    maxSlider.style('margin-bottom', '10px');
    
    // Amplitude scale
    let scaleLabel = createElement('label', `Amplitude Scale: ${frequencyBands[i].scale.toFixed(1)}x`);
    scaleLabel.parent(container);
    scaleLabel.style('display', 'block');
    scaleLabel.style('font-size', '12px');
    scaleLabel.style('margin-bottom', '3px');
    
    let scaleSlider = createSlider(0.1, 5.0, frequencyBands[i].scale, 0.1);
    scaleSlider.parent(container);
    scaleSlider.style('width', '100%');
    
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
    console.log("New audio file loaded");
  }
}

function draw() {
  background(255);
  
  // Update frequency band settings from sliders
  updateBandSettings();
  
  // Record frequency data while playing (with sampling rate control)
  if (song && song.isPlaying() && isRecording) {
    samplingCounter++;
    if (samplingCounter >= 60 / samplingSlider.value()) {
      let spectrum = fft.analyze();
      let dataPoint = analyzeFrequencyBands(spectrum);
      frequencyData.push(dataPoint);
      samplingCounter = 0;
    }
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
  let dataPoint = { time: song ? song.currentTime() : 0, bands: [] };
  
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

function drawFrequencyLines() {
  if (frequencyData.length === 0) return;
  
  let margin = 80;
  let plotWidth = width - 2 * margin;
  let plotHeight = (height - 2 * margin - 80) / numBands;
  
  // Draw axes and grid
  stroke(0);
  strokeWeight(2);
  line(margin, height - margin, width - margin, height - margin); // X-axis
  line(margin, margin, margin, height - margin); // Y-axis
  
  // Draw time labels
  textAlign(CENTER, TOP);
  textSize(10);
  fill(0);
  let duration = song ? song.duration() : 0;
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, duration);
    let x = map(i, 0, 10, margin, width - margin);
    text(time.toFixed(1) + "s", x, height - margin + 10);
    
    stroke(200);
    strokeWeight(0.5);
    line(x, margin, x, height - margin);
  }
  
  // Draw amplitude labels and sections for each band
  textAlign(RIGHT, CENTER);
  textSize(9);
  
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
      strokeWeight(2);
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

function drawUI() {
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  
  let info = [];
  if (song) {
    info.push(`Duration: ${song.duration().toFixed(1)}s`);
    info.push(`Current time: ${song.currentTime().toFixed(1)}s`);
  }
  info.push(`Recording: ${isRecording ? 'ON' : 'OFF'}`);
  info.push(`Data points: ${frequencyData.length}`);
  info.push(`Bands: ${numBands}`);
  
  for (let i = 0; i < info.length; i++) {
    text(info[i], 10, 85 + i * 15);
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
    isRecording = true;
    song.play();
    playButton.html("⏸ Stop & Pause");
    console.log("Started playing and recording");
  } else {
    isRecording = false;
    song.pause();
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