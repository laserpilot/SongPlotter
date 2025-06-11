let song;
let fft;
let frequencyData = [];
let isRecording = false;
let playButton, exportButton, fileInput;
let canvasWidth = 1200;
let canvasHeight = 800;
let fftSize = 1024;

// Frequency range settings with GUI controls
let lowRange = { min: 20, max: 250 };
let midRange = { min: 250, max: 4000 };
let highRange = { min: 4000, max: 20000 };
let samplingRate = 10; // How many samples per second
let samplingCounter = 0;

// GUI elements
let lowMinSlider, lowMaxSlider, midMinSlider, midMaxSlider, highMinSlider, highMaxSlider;
let samplingSlider;

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
  
  exportButton = createButton("📄 Export SVG");
  exportButton.mousePressed(exportSVG);
  exportButton.position(150, 10);
  
  // File input for loading audio files
  fileInput = createFileInput(handleFile);
  fileInput.position(10, 40);
  
  // Create frequency range controls
  createFrequencyControls();
  
  console.log("Setup complete");
  if (song) song.setVolume(0.3);
}

function createFrequencyControls() {
  let yStart = 80;
  let spacing = 60;
  
  // Low range controls
  createElement('h4', 'Low Range (Bass)').position(canvasWidth + 20, yStart);
  createElement('label', 'Min: ').position(canvasWidth + 20, yStart + 25);
  lowMinSlider = createSlider(20, 500, lowRange.min);
  lowMinSlider.position(canvasWidth + 60, yStart + 25);
  createElement('label', 'Max: ').position(canvasWidth + 20, yStart + 45);
  lowMaxSlider = createSlider(100, 1000, lowRange.max);
  lowMaxSlider.position(canvasWidth + 60, yStart + 45);
  
  // Mid range controls
  yStart += spacing;
  createElement('h4', 'Mid Range').position(canvasWidth + 20, yStart);
  createElement('label', 'Min: ').position(canvasWidth + 20, yStart + 25);
  midMinSlider = createSlider(200, 2000, midRange.min);
  midMinSlider.position(canvasWidth + 60, yStart + 25);
  createElement('label', 'Max: ').position(canvasWidth + 20, yStart + 45);
  midMaxSlider = createSlider(1000, 8000, midRange.max);
  midMaxSlider.position(canvasWidth + 60, yStart + 45);
  
  // High range controls
  yStart += spacing;
  createElement('h4', 'High Range (Treble)').position(canvasWidth + 20, yStart);
  createElement('label', 'Min: ').position(canvasWidth + 20, yStart + 25);
  highMinSlider = createSlider(2000, 10000, highRange.min);
  highMinSlider.position(canvasWidth + 60, yStart + 25);
  createElement('label', 'Max: ').position(canvasWidth + 20, yStart + 45);
  highMaxSlider = createSlider(5000, 20000, highRange.max);
  highMaxSlider.position(canvasWidth + 60, yStart + 45);
  
  // Sampling rate control
  yStart += spacing;
  createElement('h4', 'Sampling Rate').position(canvasWidth + 20, yStart);
  createElement('label', 'Samples/sec: ').position(canvasWidth + 20, yStart + 25);
  samplingSlider = createSlider(1, 60, samplingRate);
  samplingSlider.position(canvasWidth + 100, yStart + 25);
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
  
  // Update frequency ranges from sliders
  updateFrequencyRanges();
  
  // Record frequency data while playing (with sampling rate control)
  if (song && song.isPlaying() && isRecording) {
    samplingCounter++;
    if (samplingCounter >= 60 / samplingRate) { // Convert to frame-based sampling
      let spectrum = fft.analyze();
      let dataPoint = analyzeFrequencyRanges(spectrum);
      frequencyData.push(dataPoint);
      samplingCounter = 0;
    }
  }
  
  // Draw the frequency lines
  drawFrequencyLines();
  
  // Draw UI info
  drawUI();
}

function updateFrequencyRanges() {
  lowRange.min = lowMinSlider.value();
  lowRange.max = lowMaxSlider.value();
  midRange.min = midMinSlider.value();
  midRange.max = midMaxSlider.value();
  highRange.min = highMinSlider.value();
  highRange.max = highMaxSlider.value();
  samplingRate = samplingSlider.value();
}

function analyzeFrequencyRanges(spectrum) {
  let nyquist = 22050; // Sample rate / 2
  let binSize = nyquist / spectrum.length;
  
  let lowSum = 0, midSum = 0, highSum = 0;
  let lowCount = 0, midCount = 0, highCount = 0;
  
  for (let i = 0; i < spectrum.length; i++) {
    let freq = i * binSize;
    let amplitude = spectrum[i];
    
    if (freq >= lowRange.min && freq <= lowRange.max) {
      lowSum += amplitude;
      lowCount++;
    }
    if (freq >= midRange.min && freq <= midRange.max) {
      midSum += amplitude;
      midCount++;
    }
    if (freq >= highRange.min && freq <= highRange.max) {
      highSum += amplitude;
      highCount++;
    }
  }
  
  return {
    time: song ? song.currentTime() : 0,
    low: lowCount > 0 ? lowSum / lowCount : 0,
    mid: midCount > 0 ? midSum / midCount : 0,
    high: highCount > 0 ? highSum / highCount : 0
  };
}

function drawFrequencyLines() {
  if (frequencyData.length === 0) return;
  
  let margin = 80;
  let plotWidth = width - 2 * margin;
  let plotHeight = (height - 2 * margin - 80) / 3; // Divide into 3 sections
  
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
  
  // Draw amplitude labels and sections
  textAlign(RIGHT, CENTER);
  let sectionHeight = plotHeight;
  let sections = ['High', 'Mid', 'Low'];
  let colors = ['red', 'green', 'blue'];
  
  for (let section = 0; section < 3; section++) {
    let sectionY = margin + section * sectionHeight;
    
    // Section label
    fill(0);
    text(sections[section], margin - 10, sectionY + sectionHeight / 2);
    
    // Grid lines
    stroke(200);
    strokeWeight(0.5);
    line(margin, sectionY, width - margin, sectionY);
    line(margin, sectionY + sectionHeight, width - margin, sectionY + sectionHeight);
    
    // Draw frequency line
    if (frequencyData.length > 1) {
      stroke(colors[section]);
      strokeWeight(2);
      noFill();
      
      beginShape();
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, width - margin);
        let amplitude = section === 0 ? frequencyData[i].high : 
                       section === 1 ? frequencyData[i].mid : 
                       frequencyData[i].low;
        let y = map(amplitude, 0, 255, sectionY + sectionHeight, sectionY);
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
  info.push(`Sampling rate: ${samplingRate} samples/sec`);
  info.push(`Low: ${lowRange.min}-${lowRange.max}Hz`);
  info.push(`Mid: ${midRange.min}-${midRange.max}Hz`);
  info.push(`High: ${highRange.min}-${highRange.max}Hz`);
  
  for (let i = 0; i < info.length; i++) {
    text(info[i], 10, 350 + i * 15);
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
  let plotHeight = (canvasHeight - 2 * margin - 80) / 3;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .axis { stroke: black; stroke-width: 2; }
    .grid { stroke: #cccccc; stroke-width: 0.5; }
    .label { font-family: Arial, sans-serif; font-size: 10px; fill: black; }
    .low-line { stroke: blue; stroke-width: 2; fill: none; }
    .mid-line { stroke: green; stroke-width: 2; fill: none; }
    .high-line { stroke: red; stroke-width: 2; fill: none; }
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
  
  // Section labels and grid lines
  let sections = ['High', 'Mid', 'Low'];
  let classes = ['high-line', 'mid-line', 'low-line'];
  
  for (let section = 0; section < 3; section++) {
    let sectionY = margin + section * plotHeight;
    svg += `
  <line x1="${margin}" y1="${sectionY}" x2="${canvasWidth - margin}" y2="${sectionY}" class="grid"/>
  <line x1="${margin}" y1="${sectionY + plotHeight}" x2="${canvasWidth - margin}" y2="${sectionY + plotHeight}" class="grid"/>
  <text x="${margin - 10}" y="${sectionY + plotHeight / 2}" text-anchor="end" class="label">${sections[section]}</text>`;
  }
  
  // Frequency lines
  if (frequencyData.length > 1) {
    for (let section = 0; section < 3; section++) {
      let sectionY = margin + section * plotHeight;
      svg += `
  <polyline class="${classes[section]}" points="`;
      
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, canvasWidth - margin);
        let amplitude = section === 0 ? frequencyData[i].high : 
                       section === 1 ? frequencyData[i].mid : 
                       frequencyData[i].low;
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