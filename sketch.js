let song;
let fft;
let frequencyData = [];
let isRecording = false;
let playButton, exportButton, fileInput;
let canvasWidth = 1191*2;  // A3 landscape width
let canvasHeight = 842*2;  // A3 landscape height
let fftSize = 1024;

// Dynamic frequency bands (3-8 bands)
let numBands = 3;
let frequencyBands = [
  { min: 20, max: 250, scale: 1.0, color: [0, 0, 255] },     // Blue
  { min: 250, max: 4000, scale: 1.0, color: [0, 255, 0] },   // Green  
  { min: 4000, max: 10000, scale: 1.0, color: [255, 0, 0] }  // Red
];
let samplingRate = 10;
let samplingCounter = 0;
let smoothingFrames = 3;
let smoothingBuffer = [];
let overlayMode = true;
let amplitudeNormalization = true;
let amplitudeStats = { low: [], mid: [], high: [] };
let logarithmicScaling = true;
let logarithmicIntensity = 0.5; // Controls the curve shape (0.1 to 1.0)
let logarithmicMultiplier = 2.0; // Controls the overall scaling (0.5 to 4.0)
let radialMode = false;
let currentSongName = "unknown_song";
let showGrid = true;
let showLabels = true;

// Batch processing variables
let batchMode = false;
let batchFiles = [];
let currentBatchIndex = 0;
let batchProgress = "";
let batchProcessing = false;
let batchFileSelectionTimeout;
let lastBatchFileTime = 0;

// GUI elements
let numBandsSlider, samplingSlider, smoothingSlider, overlayToggle, normalizationToggle;
let logarithmicToggle, logIntensitySlider, logMultiplierSlider, radialToggle;
let batchButton, batchFileInput, muteButton, gridToggle, labelsToggle;
let songVolumeSlider, outputVolumeSlider;
let bandControls = [];
let guiPanel;
let audioMuted = false;
let songVolume = 0.3; // Song volume (affects FFT analysis)
let outputVol = 0.3; // Output volume (what you hear)

// UI scaling based on canvas size
let baseCanvasWidth = 1191;
let baseCanvasHeight = 842;
let uiScale = canvasWidth / baseCanvasWidth;
let uiFontSize = 16; // Global font size for UI elements

function preload() {
  song = loadSound('musicfiles/02 Break.m4a', loaded);
  song.setVolume(songVolume);
  currentSongName = "[Need to load song]";
}

function setup() {
  let cnv = createCanvas(canvasWidth, canvasHeight);
  cnv.position(20, 100);
  fft = new p5.FFT(0.8, fftSize);
  fft.setInput(song);
  
  // Set initial UI scale
  let availableWidth = windowWidth - 400;
  let availableHeight = windowHeight - 120;
  let scaleX = availableWidth / canvasWidth;
  let scaleY = availableHeight / canvasHeight;
  uiScale = min(scaleX, scaleY, 1.0);
  
  // Apply initial canvas scaling
  cnv.style('transform', `scale(${uiScale})`);
  cnv.style('transform-origin', 'top left');
  
  createCleanUI();
  
  console.log("Setup complete");
  outputVolume(outputVol);
}

function windowResized() {
  // Update UI scale based on current window size vs canvas size
  let availableWidth = windowWidth - 400; // Leave space for GUI panel
  let availableHeight = windowHeight - 120; // Leave space for margins
  
  let scaleX = availableWidth / canvasWidth;
  let scaleY = availableHeight / canvasHeight;
  uiScale = min(scaleX, scaleY, 1.0); // Don't scale larger than original
  
  // Update canvas scale via CSS (visual scaling only)
  let canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.style.transform = `scale(${uiScale})`;
    canvas.style.transformOrigin = 'top left';
  }
  
  // Update GUI panel position without recreating everything
  if (guiPanel) {
    let canvasRect = canvas ? canvas.getBoundingClientRect() : {left: 20, top: 100};
    guiPanel.position(canvasRect.left + (canvasWidth * uiScale) + 20, canvasRect.top);
    guiPanel.style('height', `${(canvasHeight * uiScale) - 20}px`);
  }
}

function createCleanUI() {
  // Create unified top bar with scaling
  let topBar = createDiv('');
  topBar.position(10, 10);
  topBar.style('width', `${(canvasWidth * uiScale)+100}px`);
  topBar.style('height', '50px');
  topBar.style('background-color', '#f8f8f8');
  topBar.style('border', '2px solid #ddd');
  topBar.style('border-radius', '8px');
  topBar.style('padding', '15px');
  topBar.style('display', 'flex');
  topBar.style('gap', '15px');
  topBar.style('align-items', 'center');
  topBar.style('font-family', 'Arial, sans-serif');
  topBar.style('font-size', `${uiFontSize}px`);
  topBar.style('flex-wrap', 'wrap');
  
  // SongPlotter branding section
  let brandingSection = createDiv('');
  brandingSection.parent(topBar);
  brandingSection.style('display', 'flex');
  brandingSection.style('gap', '10px');
  brandingSection.style('align-items', 'center');
  
  let brandLabel = createElement('h2', 'SongPlotter');
  brandLabel.parent(brandingSection);
  brandLabel.style('margin', '0');
  brandLabel.style('font-size', '18px');
  brandLabel.style('font-weight', 'bold');
  brandLabel.style('color', '#333');
  
  let aboutButton = createButton('About');
  aboutButton.mousePressed(showAboutModal);
  aboutButton.parent(brandingSection);
  aboutButton.style('padding', '4px 8px');
  aboutButton.style('font-size', '12px');
  aboutButton.style('border-radius', '4px');
  aboutButton.style('border', '1px solid #ccc');
  aboutButton.style('background-color', '#fff');
  aboutButton.style('color', '#666');
  aboutButton.style('cursor', 'pointer');
  
   // File inputs section
  let filesSection = createDiv('');
  filesSection.parent(topBar);
  filesSection.style('display', 'flex');
  filesSection.style('gap', '10px');
  filesSection.style('align-items', 'center');
  
  let fileLabel = createElement('label', 'File:');
  fileLabel.parent(filesSection);
  fileLabel.style('font-weight', 'bold');
  fileLabel.style('font-size', `${uiFontSize}px`);
  
  fileInput = createFileInput(handleFile);
  fileInput.parent(filesSection);
  fileInput.style('font-size', `${uiFontSize}px`);
  
  let batchLabel = createElement('label', 'Load Batch:');
  batchLabel.parent(filesSection);
  batchLabel.style('font-weight', 'bold');
  batchLabel.style('font-size', `${uiFontSize}px`);
  
  batchFileInput = createFileInput(handleBatchFiles);
  batchFileInput.parent(filesSection);
  batchFileInput.style('font-size', `${uiFontSize}px`);
  batchFileInput.attribute('multiple', true);
  batchFileInput.attribute('accept', 'audio/*');

  // Buttons section
  let buttonsSection = createDiv('');
  buttonsSection.parent(topBar);
  buttonsSection.style('display', 'flex');
  buttonsSection.style('gap', '10px');
  buttonsSection.style('align-items', 'center');
  
  playButton = createButton("▶ Play and Start Recording");
  playButton.mousePressed(togglePlayAndRecord);
  playButton.parent(buttonsSection);
  playButton.style('padding', '8px 12px');
  playButton.style('font-size', `${uiFontSize}px`);
  playButton.style('border-radius', '6px');
  playButton.style('border', 'none');
  playButton.style('background-color', '#2ecc71');
  playButton.style('color', 'white');
  playButton.style('cursor', 'pointer');
  
  muteButton = createButton(audioMuted ? "🔇 Unmute" : "🔊 Mute");
  muteButton.mousePressed(toggleAudioMute);
  muteButton.parent(buttonsSection);
  muteButton.style('padding', '8px 12px');
  muteButton.style('font-size', `${uiFontSize}px`);
  muteButton.style('border-radius', '6px');
  muteButton.style('border', 'none');
  muteButton.style('background-color', audioMuted ? '#e74c3c' : '#27ae60');
  muteButton.style('color', 'white');
  muteButton.style('cursor', 'pointer');
  
  exportButton = createButton("📄 Export");
  exportButton.mousePressed(exportSVG);
  exportButton.parent(buttonsSection);
  exportButton.style('padding', '8px 12px');
  exportButton.style('font-size', `${uiFontSize}px`);
  exportButton.style('border-radius', '6px');
  exportButton.style('border', 'none');
  exportButton.style('background-color', '#3498db');
  exportButton.style('color', 'white');
  exportButton.style('cursor', 'pointer');
  
  batchButton = createButton("🗂️ Run Batch");
  batchButton.mousePressed(startBatchProcessing);
  batchButton.parent(buttonsSection);
  batchButton.style('padding', '8px 12px');
  batchButton.style('font-size', `${uiFontSize}px`);
  batchButton.style('border-radius', '6px');
  batchButton.style('border', 'none');
  batchButton.style('background-color', '#e74c3c');
  batchButton.style('color', 'white');
  batchButton.style('cursor', 'pointer');
  
  // Playhead section
  let playheadSection = createDiv('');
  playheadSection.parent(topBar);
  playheadSection.style('display', 'flex');
  playheadSection.style('flex-direction', 'column');
  playheadSection.style('gap', '5px');
  playheadSection.style('min-width', '300px');
  
  // Status display
  let statusDisplay = createDiv('Status: Loading...');
  statusDisplay.parent(playheadSection);
  statusDisplay.style('font-size', `${uiFontSize}px`);
  statusDisplay.style('color', '#666');
  statusDisplay.id('statusDisplay');
  
  // Playhead bar
  let playheadContainer = createDiv('');
  playheadContainer.parent(playheadSection);
  playheadContainer.style('position', 'relative');
  playheadContainer.style('height', '20px');
  playheadContainer.style('width', '300px');
  playheadContainer.style('background-color', '#ddd');
  playheadContainer.style('border-radius', '4px');
  playheadContainer.style('overflow', 'hidden');
  
  let playheadBar = createDiv('');
  playheadBar.parent(playheadContainer);
  playheadBar.style('height', '100%');
  playheadBar.style('width', '0%');
  playheadBar.style('background-color', '#3498db');
  playheadBar.style('transition', 'width 0.1s ease');
  playheadBar.id('playheadBar');
  
  // Time display
  let timeDisplay = createDiv('0.0s / 0.0s');
  timeDisplay.parent(playheadSection);
  timeDisplay.style('font-size', `${uiFontSize}px`);
  timeDisplay.style('color', '#666');
  timeDisplay.id('timeDisplay');
  
  // Create compact GUI panel
  createGUIPanel();
}

function createGUIPanel() {
  // Create compact GUI panel div positioned relative to canvas
  let canvas = document.querySelector('canvas');
  let canvasRect = canvas ? canvas.getBoundingClientRect() : {left: 20, top: 100};
  
  guiPanel = createDiv('');
  guiPanel.position(canvasRect.left + (canvasWidth * uiScale) + 20, canvasRect.top);
  guiPanel.style('width', '400px');
  guiPanel.style('height', `${(canvasHeight * uiScale) - 20}px`);
  guiPanel.style('background-color', '#f8f8f8');
  guiPanel.style('border', '2px solid #ddd');
  guiPanel.style('border-radius', '8px');
  guiPanel.style('padding', '15px');
  guiPanel.style('font-family', 'Arial, sans-serif');
  guiPanel.style('font-size', `${uiFontSize}px`);
  guiPanel.style('overflow-y', 'auto');
  guiPanel.style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
  
  // Number of bands control
  let title = createElement('h3', 'Configuration Controls');
  title.parent(guiPanel);
  title.style('margin', '0 0 20px 0');
  title.style('color', '#333');
  title.style('font-size', '18px');
  
  let bandsLabel = createElement('label', `Number of Bands (1-8): ${numBands}`);
  bandsLabel.parent(guiPanel);
  bandsLabel.style('display', 'block');
  bandsLabel.style('margin-bottom', '8px');
  bandsLabel.style('font-weight', 'bold');
  bandsLabel.style('font-size', '14px');
  bandsLabel.id('bandsLabel');
  
  numBandsSlider = createSlider(1, 8, numBands);
  numBandsSlider.parent(guiPanel);
  numBandsSlider.style('width', '100%');
  numBandsSlider.style('height', '20px');
  numBandsSlider.style('margin-bottom', '20px');
  numBandsSlider.input(updateBandCount);
  
  // Sampling rate control
  let samplingLabel = createElement('label', `Sampling Rate (samples/sec): ${samplingRate}`);
  samplingLabel.parent(guiPanel);
  samplingLabel.style('display', 'block');
  samplingLabel.style('margin-bottom', '8px');
  samplingLabel.style('font-weight', 'bold');
  samplingLabel.style('font-size', '14px');
  samplingLabel.id('samplingLabel');
  
  samplingSlider = createSlider(1, 60, samplingRate);
  samplingSlider.parent(guiPanel);
  samplingSlider.style('width', '100%');
  samplingSlider.style('height', '20px');
  samplingSlider.style('margin-bottom', '20px');
  
  // Smoothing control
  let smoothingLabel = createElement('label', `Smoothing (frames): ${smoothingFrames}`);
  smoothingLabel.parent(guiPanel);
  smoothingLabel.style('display', 'block');
  smoothingLabel.style('margin-bottom', '8px');
  smoothingLabel.style('font-weight', 'bold');
  smoothingLabel.style('font-size', '14px');
  smoothingLabel.id('smoothingLabel');
  
  smoothingSlider = createSlider(1, 60, smoothingFrames);
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
  normalizationToggle.style('margin-bottom', '15px');
  normalizationToggle.style('font-weight', 'bold');
  normalizationToggle.style('font-size', '14px');
  
  // Logarithmic scaling toggle
  logarithmicToggle = createCheckbox('Logarithmic frequency scaling', logarithmicScaling);
  logarithmicToggle.parent(guiPanel);
  logarithmicToggle.style('margin-bottom', '15px');
  logarithmicToggle.style('font-weight', 'bold');
  logarithmicToggle.style('font-size', '14px');
  logarithmicToggle.style('color', '#333');
  
  // Logarithmic intensity control
  let logIntensityLabel = createElement('label', `Log Curve Intensity (0.1-1.0): ${logarithmicIntensity.toFixed(1)}`);
  logIntensityLabel.parent(guiPanel);
  logIntensityLabel.style('display', 'block');
  logIntensityLabel.style('margin-bottom', '8px');
  logIntensityLabel.style('font-weight', 'bold');
  logIntensityLabel.style('font-size', '14px');
  logIntensityLabel.id('logIntensityLabel');
  
  logIntensitySlider = createSlider(0.1, 1.0, logarithmicIntensity, 0.1);
  logIntensitySlider.parent(guiPanel);
  logIntensitySlider.style('width', '100%');
  logIntensitySlider.style('height', '20px');
  logIntensitySlider.style('margin-bottom', '20px');
  
  // Logarithmic multiplier control
  let logMultiplierLabel = createElement('label', `Log Scale Multiplier (0.5-4.0): ${logarithmicMultiplier.toFixed(1)}`);
  logMultiplierLabel.parent(guiPanel);
  logMultiplierLabel.style('display', 'block');
  logMultiplierLabel.style('margin-bottom', '8px');
  logMultiplierLabel.style('font-weight', 'bold');
  logMultiplierLabel.style('font-size', '14px');
  logMultiplierLabel.id('logMultiplierLabel');
  
  logMultiplierSlider = createSlider(0.5, 4.0, logarithmicMultiplier, 0.1);
  logMultiplierSlider.parent(guiPanel);
  logMultiplierSlider.style('width', '100%');
  logMultiplierSlider.style('height', '20px');
  logMultiplierSlider.style('margin-bottom', '20px');
  
  // Radial mode toggle  
  radialToggle = createCheckbox('Radial visualization (circular)', radialMode);
  radialToggle.parent(guiPanel);
  radialToggle.style('margin-bottom', '15px');
  radialToggle.style('font-weight', 'bold');
  radialToggle.style('font-size', '14px');
  radialToggle.style('color', '#333');
  
  // Grid visibility toggle
  gridToggle = createCheckbox('Show grid lines', showGrid);
  gridToggle.parent(guiPanel);
  gridToggle.style('margin-bottom', '15px');
  gridToggle.style('font-weight', 'bold');
  gridToggle.style('font-size', '14px');
  gridToggle.style('color', '#333');
  
  // Labels visibility toggle
  labelsToggle = createCheckbox('Show text labels', showLabels);
  labelsToggle.parent(guiPanel);
  labelsToggle.style('margin-bottom', '20px');
  labelsToggle.style('font-weight', 'bold');
  labelsToggle.style('font-size', '14px');
  labelsToggle.style('color', '#333');
  
  // Song volume control
  let songVolumeLabel = createElement('label', `Song Volume: ${songVolume.toFixed(1)}`);
  songVolumeLabel.parent(guiPanel);
  songVolumeLabel.style('display', 'block');
  songVolumeLabel.style('margin-bottom', '8px');
  songVolumeLabel.style('font-weight', 'bold');
  songVolumeLabel.style('font-size', '14px');
  songVolumeLabel.id('songVolumeLabel');
  
  songVolumeSlider = createSlider(0, 1.0, songVolume, 0.01);
  songVolumeSlider.parent(guiPanel);
  songVolumeSlider.style('width', '100%');
  songVolumeSlider.style('height', '20px');
  songVolumeSlider.style('margin-bottom', '20px');
  
  // Output volume control
  let outputVolumeLabel = createElement('label', `Output Volume: ${outputVol.toFixed(1)}`);
  outputVolumeLabel.parent(guiPanel);
  outputVolumeLabel.style('display', 'block');
  outputVolumeLabel.style('margin-bottom', '8px');
  outputVolumeLabel.style('font-weight', 'bold');
  outputVolumeLabel.style('font-size', '14px');
  outputVolumeLabel.id('outputVolumeLabel');
  
  outputVolumeSlider = createSlider(0, 1.0, outputVol, 0.01);
  outputVolumeSlider.parent(guiPanel);
  outputVolumeSlider.style('width', '100%');
  outputVolumeSlider.style('height', '20px');
  outputVolumeSlider.style('margin-bottom', '30px');
  
  // Create initial band controls
  createBandControls();
}

function updateBandCount() {
  let newNumBands = numBandsSlider.value();
  if (newNumBands !== numBands) {
    numBands = newNumBands;
    updateFrequencyBands();
    recreateBandControls();
    
    // Update the bands label
    let bandsLabelElement = document.getElementById('bandsLabel');
    if (bandsLabelElement) {
      bandsLabelElement.innerHTML = `Number of Bands (1-8): ${numBands}`;
    }
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
  let maxFreq = 10000;
  let logMin = Math.log10(minFreq);
  let logMax = Math.log10(maxFreq);
  
  for (let i = 0; i < numBands; i++) {
    let logStart = logMin + (i / numBands) * (logMax - logMin);
    let logEnd = logMin + ((i + 1) / numBands) * (logMax - logMin);
    
    frequencyBands.push({
      min: Math.round(Math.pow(9, logStart)),
      max: Math.round(Math.pow(9, logEnd)),
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
  // Reconnect FFT to the new song (only if FFT exists)
  if (fft && song) {
    fft.setInput(song);
    console.log("FFT reconnected to new song");
  }
  outputVolume(outputVol);
}

function handleFile(file) {
  if (file.type === 'audio') {
    song = loadSound(file.data, loaded);
    frequencyData = [];
    smoothingBuffer = [];
    amplitudeStats = { low: [], mid: [], high: [] };
    
    // Extract filename for use in SVG export
    currentSongName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    console.log("New audio file loaded:", currentSongName);
  }
}

function handleBatchFiles(files) {
  // Clear any existing timeout
  if (batchFileSelectionTimeout) {
    clearTimeout(batchFileSelectionTimeout);
  }
  
  // Handle case where p5.js may call this function for each individual file
  // or pass an array of files
  if (!Array.isArray(files)) {
    // Single file case - reset batch on first file, then add subsequent files
    if (files && files.type === 'audio') {
      // If this is the first file in a new selection, reset the batch
      if (batchFiles.length === 0 || Date.now() - lastBatchFileTime > 1000) {
        batchFiles = [];
        console.log("Starting new batch file selection");
      }
      batchFiles.push(files);
      lastBatchFileTime = Date.now();
      console.log(`Added file to batch: ${files.name}. Total: ${batchFiles.length}`);
      
      // Set a timeout to finalize the batch selection
      batchFileSelectionTimeout = setTimeout(() => {
        console.log(`Batch file selection complete: ${batchFiles.length} audio files`);
        batchProgress = `${batchFiles.length} files ready for batch processing`;
      }, 500);
    }
  } else {
    // Array of files case - reset and populate batch
    console.log(`files: ${files.length}`);
    batchFiles = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === 'audio') {
        batchFiles.push(files[i]);
      }
    }
    console.log(`${batchFiles.length} audio files selected for batch processing`);
    batchProgress = `${batchFiles.length} files ready for batch processing`;
  }
}

function startBatchProcessing() {
  if (batchFiles.length === 0) {
    console.log("No batch files selected. Please select audio files first.");
    return;
  }
  
  if (batchProcessing) {
    console.log("Batch processing already in progress");
    return;
  }
  
  batchMode = true;
  batchProcessing = true;
  currentBatchIndex = 0;
  batchProgress = "Starting batch processing...";
  
  console.log(`Starting batch processing of ${batchFiles.length} files`);
  processBatchFile();
}

function processBatchFile() {
  if (currentBatchIndex >= batchFiles.length) {
    // Batch processing complete
    batchMode = false;
    batchProcessing = false;
    batchProgress = `Batch processing complete! Processed ${batchFiles.length} files.`;
    console.log("Batch processing completed");
    return;
  }
  
  let file = batchFiles[currentBatchIndex];
  currentSongName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  batchProgress = `Processing ${currentBatchIndex + 1}/${batchFiles.length}: ${currentSongName}`;
  
  console.log(`Processing batch file ${currentBatchIndex + 1}/${batchFiles.length}: ${currentSongName}`);
  
  // Reset data for new file
  frequencyData = [];
  smoothingBuffer = [];
  amplitudeStats = { low: [], mid: [], high: [] };
  
  // Load and process the file
  song = loadSound(file.data, () => {
    // Reconnect FFT to the new song (ensure both exist)
    if (fft && song) {
      fft.setInput(song);
      console.log("FFT reconnected to batch song:", currentSongName);
    }
    
    // Set output volume based on mute state
    outputVolume(audioMuted ? 0 : outputVol);
    
    // Start recording and playback
    isRecording = true;
    samplingCounter = 0;
    song.play();
    
    // Set up completion handler
    song.onended(() => {
      isRecording = false;
      
      // Export both linear and radial versions
      exportBatchFile();
      
      // Move to next file
      currentBatchIndex++;
      setTimeout(processBatchFile, 500); // Small delay between files
    });
  });
}

function exportBatchFile() {
  if (frequencyData.length === 0) {
    console.log("No data to export for batch file");
    return;
  }
  
  // Save current UI state
  let originalRadialMode = radialMode;
  let originalOverlayMode = overlayMode;
  
  // Export linear separate version
  radialMode = false;
  overlayMode = false;
  let linearSeparateSVG = generateLinearSeparateSVG();
  downloadSVG(linearSeparateSVG, `${currentSongName}_linear_separate.svg`);
  
  // Export linear overlay version
  overlayMode = true;
  let linearOverlaySVG = generateLinearOverlaySVG();
  downloadSVG(linearOverlaySVG, `${currentSongName}_linear_overlay.svg`);
  
  // Export radial separate version
  radialMode = true;
  overlayMode = false;
  let radialSeparateSVG = generateRadialSeparateSVG();
  downloadSVG(radialSeparateSVG, `${currentSongName}_radial_separate.svg`);
  
  // Export radial overlay version
  overlayMode = true;
  let radialOverlaySVG = generateRadialOverlaySVG();
  downloadSVG(radialOverlaySVG, `${currentSongName}_radial_overlay.svg`);
  
  // Restore original UI state
  radialMode = originalRadialMode;
  overlayMode = originalOverlayMode;
  
  console.log(`Exported 4 SVG files for ${currentSongName}`);
}

function downloadSVG(svgContent, filename) {
  let blob = new Blob([svgContent], { type: "image/svg+xml" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function draw() {
  background(255);
  
  // Update frequency band settings from sliders
  updateBandSettings();
  
  // Update settings
  smoothingFrames = smoothingSlider.value();
  overlayMode = overlayToggle.checked();
  amplitudeNormalization = normalizationToggle.checked();
  logarithmicScaling = logarithmicToggle.checked();
  logarithmicIntensity = logIntensitySlider.value();
  logarithmicMultiplier = logMultiplierSlider.value();
  radialMode = radialToggle.checked();
  showGrid = gridToggle.checked();
  showLabels = labelsToggle.checked();
  
  // Update UI labels with current values
  let samplingLabelElement = document.getElementById('samplingLabel');
  if (samplingLabelElement) {
    samplingLabelElement.innerHTML = `Sampling Rate (samples/sec): ${samplingSlider.value()}`;
  }
  
  let smoothingLabelElement = document.getElementById('smoothingLabel');
  if (smoothingLabelElement) {
    smoothingLabelElement.innerHTML = `Smoothing (frames): ${smoothingFrames}`;
  }
  
  let logIntensityLabelElement = document.getElementById('logIntensityLabel');
  if (logIntensityLabelElement) {
    logIntensityLabelElement.innerHTML = `Log Curve Intensity (0.1-1.0): ${logarithmicIntensity.toFixed(1)}`;
  }
  
  let logMultiplierLabelElement = document.getElementById('logMultiplierLabel');
  if (logMultiplierLabelElement) {
    logMultiplierLabelElement.innerHTML = `Log Scale Multiplier (0.5-4.0): ${logarithmicMultiplier.toFixed(1)}`;
  }
  
  // Update volume controls
  if (songVolumeSlider) {
    songVolume = songVolumeSlider.value();
    if (song) {
      song.setVolume(songVolume);
    }
    let songVolumeLabelElement = document.getElementById('songVolumeLabel');
    if (songVolumeLabelElement) {
      songVolumeLabelElement.innerHTML = `Song Volume: ${songVolume.toFixed(1)}`;
    }
  }
  
  if (outputVolumeSlider) {
    outputVol = outputVolumeSlider.value();
    // Only apply output volume if not muted
    outputVolume(audioMuted ? 0 : outputVol);
    let outputVolumeLabelElement = document.getElementById('outputVolumeLabel');
    if (outputVolumeLabelElement) {
      outputVolumeLabelElement.innerHTML = `Output Volume: ${outputVol.toFixed(1)}`;
    }
  }
  
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
      
      // Apply logarithmic scaling if enabled
      if (logarithmicScaling) {
        dataPoint = applyLogarithmicScaling(dataPoint);
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
  
  // Draw the frequency visualization
  if (radialMode) {
    drawRadialVisualization();
  } else {
    drawFrequencyLines();
  }
  
  // Update DOM-based UI elements
  updateDOMStatus();
  updateDOMPlayhead();
  
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

function applyLogarithmicScaling(dataPoint) {
  if (!logarithmicScaling || dataPoint.bands.length === 0) {
    return dataPoint;
  }
  
  let scaledPoint = { time: dataPoint.time, bands: [] };
  
  for (let i = 0; i < dataPoint.bands.length; i++) {
    let band = frequencyBands[i];
    let centerFreq = (band.min + band.max) / 2;
    
    // Create logarithmic scaling curve based on frequency position
    // Map frequency from 20Hz-20kHz to 0-1, then apply log curve
    let freqNormalized = map(log(centerFreq), log(20), log(20000), 0, 1);
    freqNormalized = constrain(freqNormalized, 0, 1);
    
    // Apply logarithmic curve - higher frequencies get more boost
    let logScale = pow(freqNormalized, logarithmicIntensity) * logarithmicMultiplier;
    logScale = constrain(logScale, 0.2, 3.0); // Limit the scaling range
    
    let scaledAmplitude = dataPoint.bands[i] * logScale;
    scaledAmplitude = constrain(scaledAmplitude, 0, 255);
    
    scaledPoint.bands.push(scaledAmplitude);
  }
  
  return scaledPoint;
}

function generateMetadata() {
  let timestamp = new Date().toISOString();
  let metadata = `
  <!-- Settings Metadata -->
  <metadata>
    <song>${currentSongName}</song>
    <timestamp>${timestamp}</timestamp>
    <mode>${radialMode ? 'radial' : 'linear'}</mode>
    <overlay>${overlayMode}</overlay>
    <bands>${numBands}</bands>
    <samplingRate>${samplingSlider.value()}</samplingRate>
    <smoothingFrames>${smoothingFrames}</smoothingFrames>
    <amplitudeNormalization>${amplitudeNormalization}</amplitudeNormalization>
    <logarithmicScaling>${logarithmicScaling}</logarithmicScaling>
    <logarithmicIntensity>${logarithmicIntensity}</logarithmicIntensity>
    <logarithmicMultiplier>${logarithmicMultiplier}</logarithmicMultiplier>
    <frequencyBands>`;
  
  for (let i = 0; i < frequencyBands.length; i++) {
    let band = frequencyBands[i];
    metadata += `
      <band${i + 1} min="${band.min}" max="${band.max}" scale="${band.scale}" color="${band.color[0]},${band.color[1]},${band.color[2]}"/>`;
  }
  
  metadata += `
    </frequencyBands>
    <dataPoints>${frequencyData.length}</dataPoints>
    <canvasSize width="${canvasWidth}" height="${canvasHeight}"/>
  </metadata>`;
  
  return metadata;
}

function drawRadialVisualization() {
  if (frequencyData.length === 0) return;
  
  let centerX = width / 2;
  let centerY = (height + 120) / 2; // Account for top bar
  let maxRadius = min(width, height - 120) / 2 - 80;
  let baseRadius = 40;
  
  // Draw center and reference circles
  stroke(200);
  strokeWeight(1);
  fill(0, 0, 0, 0);
  
  // Draw concentric circles for amplitude reference
  for (let i = 1; i <= 5; i++) {
    let radius = baseRadius + (maxRadius - baseRadius) * (i / 5);
    circle(centerX, centerY, radius * 2);
  }
  
  // Draw time markers (12 hour positions)
  textAlign(CENTER, CENTER);
  textSize(14);
  fill(100);
  for (let i = 0; i < 12; i++) {
    let angle = map(i, 0, 12, 0, TWO_PI) - PI/2;
    let markRadius = maxRadius + 20;
    let x = centerX + cos(angle) * markRadius;
    let y = centerY + sin(angle) * markRadius;
    
    let timeLabel = (frequencyData.length > 0) ? 
      formatTime((frequencyData[frequencyData.length - 1].time * i) / 12) :
      formatTime(i * 5);
    text(timeLabel, x, y);
  }
  
  // Draw frequency bands in radial pattern
  if (frequencyData.length > 1) {
    if (overlayMode) {
      drawRadialOverlay(centerX, centerY, baseRadius, maxRadius);
    } else {
      drawRadialSeparate(centerX, centerY, baseRadius, maxRadius);
    }
  }
  
  // Draw center point
  fill(0);
  noStroke();
  circle(centerX, centerY, 8);
}

function drawRadialOverlay(centerX, centerY, baseRadius, maxRadius) {
  // All bands overlaid in the same circle
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let band = frequencyBands[bandIndex];
    stroke(band.color[0], band.color[1], band.color[2]);
    strokeWeight(3);
    noFill();
    
    beginShape();
    for (let i = 0; i < frequencyData.length; i++) {
      let angle = map(i, 0, frequencyData.length - 1, 0, TWO_PI) - PI/2;
      let amplitude = frequencyData[i].bands[bandIndex] || 0;
      let radius = map(amplitude, 0, 255, baseRadius, maxRadius);
      
      let x = centerX + cos(angle) * radius;
      let y = centerY + sin(angle) * radius;
      vertex(x, y);
    }
    // Close the circle
    if (frequencyData.length > 0) {
      let amplitude = frequencyData[0].bands[bandIndex] || 0;
      let radius = map(amplitude, 0, 255, baseRadius, maxRadius);
      let x = centerX + cos(-PI/2) * radius;
      let y = centerY + sin(-PI/2) * radius;
      vertex(x, y);
    }
    endShape();
  }
  
  // Draw legend
  drawRadialLegend(centerX, centerY, maxRadius);
  drawUI();
}

function drawRadialSeparate(centerX, centerY, baseRadius, maxRadius) {
  // Each band in its own concentric ring
  let radiusStep = (maxRadius - baseRadius) / numBands;
  
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let band = frequencyBands[bandIndex];
    let bandBaseRadius = baseRadius + bandIndex * radiusStep;
    let bandMaxRadius = baseRadius + (bandIndex + 1) * radiusStep;
    
    stroke(band.color[0], band.color[1], band.color[2]);
    strokeWeight(2);
    noFill();
    
    beginShape();
    for (let i = 0; i < frequencyData.length; i++) {
      let angle = map(i, 0, frequencyData.length - 1, 0, TWO_PI) - PI/2;
      let amplitude = frequencyData[i].bands[bandIndex] || 0;
      let radius = map(amplitude, 0, 255, bandBaseRadius, bandMaxRadius);
      
      let x = centerX + cos(angle) * radius;
      let y = centerY + sin(angle) * radius;
      vertex(x, y);
    }
    // Close the circle
    if (frequencyData.length > 0) {
      let amplitude = frequencyData[0].bands[bandIndex] || 0;
      let radius = map(amplitude, 0, 255, bandBaseRadius, bandMaxRadius);
      let x = centerX + cos(-PI/2) * radius;
      let y = centerY + sin(-PI/2) * radius;
      vertex(x, y);
    }
    endShape();
    
    // Draw band label
    textAlign(LEFT, CENTER);
    textSize(12);
    fill(band.color[0], band.color[1], band.color[2]);
    noStroke();
    let labelRadius = (bandBaseRadius + bandMaxRadius) / 2;
    let labelX = centerX + labelRadius + 10;
    let labelY = centerY + bandIndex * 15 - (numBands * 15) / 2;
    text(`${band.min}-${band.max}Hz`, labelX, labelY);
  }
}

function drawRadialLegend(centerX, centerY, maxRadius) {
  // Draw legend for overlay mode - moved further left to avoid overlap
  let legendX = centerX - maxRadius - 180;
  let legendY = centerY - (numBands * 20) / 2;
  
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

function drawFrequencyLines() {
  if (frequencyData.length === 0) return;
  
  let topMargin = 50; // Space for top bar
  let sideMargin = 60;
  let plotWidth = width - 2 * sideMargin;
  
  if (overlayMode) {
    drawOverlayMode(sideMargin, topMargin, plotWidth);
  } else {
    drawSeparateBands(sideMargin, topMargin, plotWidth);
  }
}

function drawSeparateBands(sideMargin, topMargin, plotWidth) {
  let bottomMargin = 120; // More space for legend below
  let plotHeight = (height - topMargin - bottomMargin) / numBands;
  
  // Draw axes
  if (showGrid) {
    stroke(0);
    strokeWeight(3);
    line(sideMargin, height - bottomMargin, width - sideMargin, height - bottomMargin); // X-axis
    line(sideMargin, topMargin, sideMargin, height - bottomMargin); // Y-axis
  }
  
  // Draw time labels
  if (showLabels) {
    drawTimeLabels(sideMargin, topMargin, bottomMargin);
  }
  
  // Draw amplitude labels and sections for each band
  if (showLabels) {
    textAlign(RIGHT, CENTER);
    textSize(14);
  }
  
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let sectionY = topMargin + bandIndex * plotHeight;
    let band = frequencyBands[bandIndex];
    
    // Section label
    if (showLabels) {
      fill(0);
      text(`${band.min}-${band.max}Hz`, sideMargin - 10, sectionY + plotHeight / 2);
    }
    
    // Grid lines
    if (showGrid) {
      stroke(200);
      strokeWeight(0.5);
      line(sideMargin, sectionY, width - sideMargin, sectionY);
      if (bandIndex === numBands - 1) {
        line(sideMargin, sectionY + plotHeight, width - sideMargin, sectionY + plotHeight);
      }
    }
    
    // Draw frequency line
    if (frequencyData.length > 1) {
      stroke(band.color[0], band.color[1], band.color[2]);
      strokeWeight(3);
      noFill();
      
      beginShape();
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, sideMargin, width - sideMargin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, sectionY + plotHeight, sectionY);
        vertex(x, y);
      }
      endShape();
    }
  }
  
  // Draw legend below the graph
  drawLegendBelow(sideMargin, height  );
  drawUI();
}

function drawOverlayMode(sideMargin, topMargin, plotWidth) {
  let bottomMargin = 120; // More space for legend below
  let plotHeight = height - topMargin - bottomMargin;
  
  // Draw axes
  if (showGrid) {
    stroke(0);
    strokeWeight(3);
    line(sideMargin, height - bottomMargin, width - sideMargin, height - bottomMargin); // X-axis
    line(sideMargin, topMargin, sideMargin, height - bottomMargin); // Y-axis
  }
  
  // Draw time labels
  if (showLabels) {
    drawTimeLabels(sideMargin, topMargin, bottomMargin);
  }
  
  // Draw amplitude grid lines
  if (showGrid) {
    stroke(200);
    strokeWeight(1);
    for (let i = 0; i <= 10; i++) {
      let y = map(i, 0, 10, height - bottomMargin, topMargin);
      line(sideMargin, y, width - sideMargin, y);
    }
  }
  
  // Draw amplitude labels
  if (showLabels) {
    textAlign(RIGHT, CENTER);
    textSize(14);
    fill(0);
    for (let i = 0; i <= 10; i++) {
      let y = map(i, 0, 10, height - bottomMargin, topMargin);
      let amplitude = map(i, 0, 10, 0, 255);
      text(Math.round(amplitude), sideMargin - 15, y);
    }
  }
  
  // Draw all frequency lines overlaid
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let band = frequencyBands[bandIndex];
      stroke(band.color[0], band.color[1], band.color[2]);
      strokeWeight(3);
      noFill();
      
      beginShape();
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, sideMargin, width - sideMargin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, height - bottomMargin, topMargin);
        vertex(x, y);
      }
      endShape();
    }
  }
  
  // Draw legend below the graph
  drawLegendBelow(sideMargin+50, height-40);
}

function drawTimeLabels(sideMargin, topMargin, bottomMargin) {
  textAlign(CENTER, TOP);
  textSize(12);
  fill(0);
  let maxTime = frequencyData.length > 0 ? 
    frequencyData[frequencyData.length - 1].time : 
    (song ? song.duration() : 0);
  
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, maxTime);
    let x = map(i, 0, 10, sideMargin, width - sideMargin);
    text(formatTime(time), x, height - bottomMargin + 15);
    
    if (showGrid) {
      stroke(200);
      strokeWeight(1);
      line(x, topMargin, x, height - bottomMargin);
    }
  }
}

function drawLegendBelow(sideMargin, legendY) {
  if (!showLabels) return;
  
  // Draw legend below the graph horizontally
  textAlign(LEFT, CENTER);
  textSize(14);
  
  let legendX = sideMargin;
  let itemWidth = 150;
  
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    let x = legendX + i * itemWidth;
    
    // Color line
    stroke(band.color[0], band.color[1], band.color[2]);
    strokeWeight(3);
    line(x, legendY, x + 25, legendY);
    
    // Label
    fill(0);
    noStroke();
    text(`${band.min}-${band.max}Hz`, x + 35, legendY);
  }
}

function updateDOMStatus() {
  let statusElement = document.getElementById('statusDisplay');
  if (statusElement) {
    let statusInfo = [];
    statusInfo.push(`Status: ${currentSongName} `);
    if (song) {
      let estimatedTime = frequencyData.length / (samplingSlider ? samplingSlider.value() : samplingRate);
      statusInfo.push(`${formatTime(estimatedTime)}/${formatTime(song.duration())}`);
    }
    statusInfo.push(`${isRecording ? 'REC' : 'IDLE'}`);
    statusInfo.push(`${frequencyData.length}pts`);
    statusInfo.push(`${numBands}bands`);
    statusInfo.push(`${overlayMode ? 'Overlay' : 'Separate'}`);
    statusInfo.push(`${radialMode ? 'Radial' : 'Linear'}`);
    statusInfo.push(`${amplitudeNormalization ? 'Norm' : ''}`);
    statusInfo.push(`${logarithmicScaling ? `Log(${logarithmicIntensity.toFixed(1)},${logarithmicMultiplier.toFixed(1)})` : ''}`);
    
    let statusText = statusInfo.filter(s => s !== '').join(' | ');
    statusElement.innerHTML = statusText;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  let minutes = Math.floor(seconds / 60);
  let secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function updateDOMPlayhead() {
  let playheadBar = document.getElementById('playheadBar');
  let timeDisplay = document.getElementById('timeDisplay');
  
  if (song && playheadBar && timeDisplay) {
    let progress = 0;
    let currentTime = frequencyData.length / (samplingSlider ? samplingSlider.value() : samplingRate);
    let totalTime = song.duration();
    
    if (totalTime > 0) {
      progress = currentTime / totalTime;
      progress = constrain(progress, 0, 1);
    }
    
    playheadBar.style.width = (progress * 100) + '%';
    playheadBar.style.backgroundColor = isRecording ? '#e74c3c' : '#3498db';
    timeDisplay.innerHTML = `${formatTime(currentTime)} / ${formatTime(totalTime)}`;
  }
}

function drawUI() {
  // Display current filename in bottom left of visualization
  fill(0);
  textAlign(CENTER, BOTTOM);
  textSize(20);
  textStyle(BOLD);
  
  let displayName = currentSongName || "No file loaded";
  if (batchProcessing && batchProgress) {
    displayName = `Processing: ${currentSongName}`;
  }
  
  // Background for filename
  // fill(255, 255, 255, 200);
  // noStroke();
  // let textWidth = textSize() * displayName.length * 0.6;
  // rect(100, height - 140, textWidth + 20, 25, 4);
  
  fill(0);
  text(displayName, canvasWidth/2, height - 30);
}


function mousePressed() {
  userStartAudio();
}

function toggleAudioMute() {
  audioMuted = !audioMuted;
  
  // Use outputVolume to mute audio output - use current outputVol setting
  outputVolume(audioMuted ? 0 : outputVol);
  
  // Update button appearance
  muteButton.html(audioMuted ? "🔇 Unmute" : "🔊 Mute");
  muteButton.style('background-color', audioMuted ? '#e74c3c' : '#27ae60');
}

function togglePlayAndRecord() {
  // Don't allow manual playback during batch processing
  if (batchProcessing) {
    console.log("Cannot use manual controls during batch processing");
    return;
  }
  
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
    
    // Set output volume based on mute state
    outputVolume(audioMuted ? 0 : outputVol);
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
  // Don't allow manual export during batch processing
  if (batchProcessing) {
    console.log("Cannot manually export during batch processing - files are auto-exported");
    return;
  }
  
  if (frequencyData.length === 0) {
    console.log("No data to export");
    return;
  }
  
  let svgContent;
  let modeStr = radialMode ? 'radial' : 'linear';
  let overlayStr = overlayMode ? 'overlay' : 'separate';
  let filename = `${currentSongName}_${modeStr}_${overlayStr}.svg`;
  
  if (radialMode) {
    svgContent = generateRadialSVG();
  } else {
    svgContent = generateLinearSVG();
  }
  
  downloadSVG(svgContent, filename);
  console.log(`SVG exported: ${filename}`);
}

function generateLinearSVG() {
  if (overlayMode) {
    return generateLinearOverlaySVG();
  } else {
    return generateLinearSeparateSVG();
  }
}

function generateLinearSeparateSVG() {
  let margin = 80;
  let plotWidth = canvasWidth - 2 * margin;
  let plotHeight = (canvasHeight - 2 * margin - 80) / numBands;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${generateMetadata()}
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
  
  <!-- Background Layer -->
  <g id="background-layer">
    <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
  </g>
  
  <!-- Grid and Axes Layer -->
  <g id="grid-axes-layer">
    <line x1="${margin}" y1="${canvasHeight - margin}" x2="${canvasWidth - margin}" y2="${canvasHeight - margin}" class="axis"/>
    <line x1="${margin}" y1="${margin}" x2="${margin}" y2="${canvasHeight - margin}" class="axis"/>`;
  
  let duration = song ? song.duration() : 0;
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, duration);
    let x = map(i, 0, 10, margin, canvasWidth - margin);
    svg += `
    <line x1="${x}" y1="${margin}" x2="${x}" y2="${canvasHeight - margin}" class="grid"/>`;
  }
  
  // Section grid lines for each band
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let sectionY = margin + bandIndex * plotHeight;
    svg += `
    <line x1="${margin}" y1="${sectionY}" x2="${canvasWidth - margin}" y2="${sectionY}" class="grid"/>`;
    if (bandIndex === numBands - 1) {
      svg += `
    <line x1="${margin}" y1="${sectionY + plotHeight}" x2="${canvasWidth - margin}" y2="${sectionY + plotHeight}" class="grid"/>`;
    }
  }
  
  svg += `
  </g>
  
  <!-- Text Labels Layer -->
  <g id="text-labels-layer">`;
  
  // Time labels
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, duration);
    let x = map(i, 0, 10, margin, canvasWidth - margin);
    svg += `
    <text x="${x}" y="${canvasHeight - margin + 20}" text-anchor="middle" class="label">${formatTime(time)}</text>`;
  }
  
  // Band labels
  for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
    let sectionY = margin + bandIndex * plotHeight;
    let band = frequencyBands[bandIndex];
    svg += `
    <text x="${margin - 10}" y="${sectionY + plotHeight / 2}" text-anchor="end" class="label">${band.min}-${band.max}Hz</text>`;
  }
  
  svg += `
  </g>
  
  <!-- Frequency Data Layer -->
  <g id="frequency-data-layer">`;
  
  // Frequency lines with band name IDs
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let sectionY = margin + bandIndex * plotHeight;
      let band = frequencyBands[bandIndex];
      let bandName = `band-${bandIndex + 1}-${band.min}hz-${band.max}hz`;
      svg += `
    <polyline id="${bandName}" class="band-${bandIndex}" points="`;
      
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
  </g>
  
  <!-- Song Title -->
  <g id="song-title-layer">
    <text x="${canvasWidth / 2}" y="${canvasHeight - 30}" text-anchor="middle" class="label" font-weight="bold" font-size="20">${currentSongName}</text>
  </g>
  
</svg>`;
  
  return svg;
}

function generateLinearOverlaySVG() {
  let margin = 80;
  let plotWidth = canvasWidth - 2 * margin;
  let plotHeight = canvasHeight - 2 * margin - 120;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${generateMetadata()}
  <style>
    .axis { stroke: black; stroke-width: 3; }
    .grid { stroke: #cccccc; stroke-width: 1; }
    .label { font-family: Arial, sans-serif; font-size: 16px; fill: black; }`;
  
  // Generate CSS classes for each band
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    svg += `
    .band-${i} { stroke: rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]}); stroke-width: 3; fill: none; }`;
  }
  
  svg += `
  </style>
  
  <!-- Background Layer -->
  <g id="background-layer">
    <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
  </g>
  
  <!-- Grid and Axes Layer -->
  <g id="grid-axes-layer">
    <line x1="${margin}" y1="${canvasHeight - margin}" x2="${canvasWidth - margin}" y2="${canvasHeight - margin}" class="axis"/>
    <line x1="${margin}" y1="${margin}" x2="${margin}" y2="${canvasHeight - margin}" class="axis"/>`;
  
  let maxTime = frequencyData.length > 0 ? frequencyData[frequencyData.length - 1].time : 0;
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, maxTime);
    let x = map(i, 0, 10, margin, canvasWidth - margin);
    svg += `
    <line x1="${x}" y1="${margin}" x2="${x}" y2="${canvasHeight - margin}" class="grid"/>`;
  }
  
  // Amplitude grid
  for (let i = 0; i <= 10; i++) {
    let y = map(i, 0, 10, canvasHeight - margin, margin);
    svg += `
    <line x1="${margin}" y1="${y}" x2="${canvasWidth - margin}" y2="${y}" class="grid"/>`;
  }
  
  svg += `
  </g>
  
  <!-- Text Labels Layer -->
  <g id="text-labels-layer">`;
  
  // Time labels
  for (let i = 0; i <= 10; i++) {
    let time = map(i, 0, 10, 0, maxTime);
    let x = map(i, 0, 10, margin, canvasWidth - margin);
    svg += `
    <text x="${x}" y="${canvasHeight - margin + 30}" text-anchor="middle" class="label">${formatTime(time)}</text>`;
  }
  
  // Amplitude labels
  for (let i = 0; i <= 10; i++) {
    let y = map(i, 0, 10, canvasHeight - margin, margin);
    let amplitude = map(i, 0, 10, 0, 255);
    svg += `
    <text x="${margin - 20}" y="${y + 5}" text-anchor="end" class="label">${Math.round(amplitude)}</text>`;
  }
  
  // Legend
  let legendX = canvasWidth - margin - 200;
  let legendY = margin + 30;
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    let y = legendY + i * 25;
    svg += `
    <line x1="${legendX}" y1="${y}" x2="${legendX + 30}" y2="${y}" stroke="rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]})" stroke-width="4"/>
    <text x="${legendX + 40}" y="${y + 5}" class="label">${band.min}-${band.max}Hz</text>`;
  }
  
  svg += `
  </g>
  
  <!-- Frequency Data Layer -->
  <g id="frequency-data-layer">`;
  
  // Frequency lines (all overlaid) with band name IDs
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let band = frequencyBands[bandIndex];
      let bandName = `band-${bandIndex + 1}-${band.min}hz-${band.max}hz`;
      svg += `
    <polyline id="${bandName}" class="band-${bandIndex}" points="`;
      
      for (let i = 0; i < frequencyData.length; i++) {
        let x = map(i, 0, frequencyData.length - 1, margin, canvasWidth - margin);
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let y = map(amplitude, 0, 255, canvasHeight - margin, margin);
        svg += `${x},${y} `;
      }
      
      svg += `"/>`;
    }
  }
  
  svg += `
  </g>
  
  <!-- Song Title -->
  <g id="song-title-layer">
    <text x="${canvasWidth / 2}" y="${canvasHeight - 30}" text-anchor="middle" class="label" font-weight="bold" font-size="20">${currentSongName}</text>
  </g>
  
</svg>`;
  
  return svg;
}

function generateRadialSVG() {
  if (overlayMode) {
    return generateRadialOverlaySVG();
  } else {
    return generateRadialSeparateSVG();
  }
}

function generateRadialOverlaySVG() {
  let centerX = canvasWidth / 2;
  let centerY = canvasHeight / 2;
  let maxRadius = min(canvasWidth, canvasHeight) / 2 - 100;
  let baseRadius = 50;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${generateMetadata()}
  <style>
    .axis { stroke: #cccccc; stroke-width: 1; fill: none; }
    .label { font-family: Arial, sans-serif; font-size: 14px; fill: black; text-anchor: middle; }
    .center { fill: black; }`;
  
  // Generate CSS classes for each band
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    svg += `
    .band-${i} { stroke: rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]}); stroke-width: 3; fill: none; }`;
  }
  
  svg += `
  </style>
  
  <!-- Background Layer -->
  <g id="background-layer">
    <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
  </g>
  
  <!-- Grid and Axes Layer -->
  <g id="grid-axes-layer">`;
  
  for (let i = 1; i <= 5; i++) {
    let radius = baseRadius + (maxRadius - baseRadius) * (i / 5);
    svg += `
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" class="axis"/>`;
  }
  
  // Center point
  svg += `
    <circle cx="${centerX}" cy="${centerY}" r="4" class="center"/>
  </g>
  
  <!-- Text Labels Layer -->
  <g id="text-labels-layer">`;
  
  // Time markers
  let maxTime = frequencyData.length > 0 ? frequencyData[frequencyData.length - 1].time : 0;
  for (let i = 0; i < 12; i++) {
    let angle = map(i, 0, 12, 0, 360) - 90;
    let markRadius = maxRadius + 20;
    let x = centerX + cos(radians(angle)) * markRadius;
    let y = centerY + sin(radians(angle)) * markRadius;
    let timeLabel = formatTime((maxTime * i) / 12);
    svg += `
    <text x="${x}" y="${y + 5}" class="label">${timeLabel}</text>`;
  }
  
  // Legend - moved further left to avoid overlap
  let legendX = centerX - maxRadius - 180;
  let legendY = centerY - (numBands * 25) / 2;
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    let y = legendY + i * 25;
    svg += `
    <line x1="${legendX}" y1="${y}" x2="${legendX + 30}" y2="${y}" stroke="rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]})" stroke-width="4"/>
    <text x="${legendX + 40}" y="${y + 5}" font-family="Arial" font-size="14" fill="black">${band.min}-${band.max}Hz</text>`;
  }
  
  svg += `
  </g>
  
  <!-- Frequency Data Layer -->
  <g id="frequency-data-layer">`;
  
  // Radial frequency lines with band name IDs
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let band = frequencyBands[bandIndex];
      let bandName = `band-${bandIndex + 1}-${band.min}hz-${band.max}hz`;
      svg += `
    <polygon id="${bandName}" class="band-${bandIndex}" points="`;
      
      for (let i = 0; i < frequencyData.length; i++) {
        let angle = map(i, 0, frequencyData.length - 1, 0, 360) - 90;
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let radius = map(amplitude, 0, 255, baseRadius, maxRadius);
        let x = centerX + cos(radians(angle)) * radius;
        let y = centerY + sin(radians(angle)) * radius;
        svg += `${x},${y} `;
      }
      
      // Close the shape
      if (frequencyData.length > 0) {
        let amplitude = frequencyData[0].bands[bandIndex] || 0;
        let radius = map(amplitude, 0, 255, baseRadius, maxRadius);
        let x = centerX + cos(radians(-90)) * radius;
        let y = centerY + sin(radians(-90)) * radius;
        svg += `${x},${y}`;
      }
      
      svg += `"/>`;
    }
  }
  
  svg += `
  </g>
  
  <!-- Song Title -->
  <g id="song-title-layer">
    <text x="${canvasWidth / 2}" y="${canvasHeight - 30}" text-anchor="middle" class="label" font-weight="bold" font-size="20">${currentSongName}</text>
  </g>
  
</svg>`;
  
  return svg;
}

function generateRadialSeparateSVG() {
  let centerX = canvasWidth / 2;
  let centerY = canvasHeight / 2;
  let maxRadius = min(canvasWidth, canvasHeight) / 2 - 100;
  let baseRadius = 50;
  let radiusStep = (maxRadius - baseRadius) / numBands;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${generateMetadata()}
  <style>
    .axis { stroke: #cccccc; stroke-width: 1; fill: none; }
    .label { font-family: Arial, sans-serif; font-size: 14px; fill: black; text-anchor: middle; }
    .center { fill: black; }`;
  
  // Generate CSS classes for each band
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    svg += `
    .band-${i} { stroke: rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]}); stroke-width: 2; fill: none; }`;
  }
  
  svg += `
  </style>
  
  <!-- Background Layer -->
  <g id="background-layer">
    <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
  </g>
  
  <!-- Grid and Axes Layer -->
  <g id="grid-axes-layer">`;
  
  for (let i = 0; i < numBands; i++) {
    let bandBaseRadius = baseRadius + i * radiusStep;
    let bandMaxRadius = baseRadius + (i + 1) * radiusStep;
    svg += `
    <circle cx="${centerX}" cy="${centerY}" r="${bandBaseRadius}" class="axis"/>
    <circle cx="${centerX}" cy="${centerY}" r="${bandMaxRadius}" class="axis"/>`;
  }
  
  // Center point
  svg += `
    <circle cx="${centerX}" cy="${centerY}" r="4" class="center"/>
  </g>
  
  <!-- Text Labels Layer -->
  <g id="text-labels-layer">`;
  
  // Time markers
  let maxTime = frequencyData.length > 0 ? frequencyData[frequencyData.length - 1].time : 0;
  for (let i = 0; i < 12; i++) {
    let angle = map(i, 0, 12, 0, 360) - 90;
    let markRadius = maxRadius + 20;
    let x = centerX + cos(radians(angle)) * markRadius;
    let y = centerY + sin(radians(angle)) * markRadius;
    let timeLabel = formatTime((maxTime * i) / 12);
    svg += `
    <text x="${x}" y="${y + 5}" class="label">${timeLabel}</text>`;
  }
  
  // Band labels
  for (let i = 0; i < numBands; i++) {
    let band = frequencyBands[i];
    let bandBaseRadius = baseRadius + i * radiusStep;
    let bandMaxRadius = baseRadius + (i + 1) * radiusStep;
    let labelRadius = (bandBaseRadius + bandMaxRadius) / 2;
    let labelX = centerX + labelRadius + 10;
    let labelY = centerY + i * 20 - (numBands * 20) / 2;
    svg += `
    <text x="${labelX}" y="${labelY}" font-family="Arial" font-size="12" fill="rgb(${band.color[0]}, ${band.color[1]}, ${band.color[2]})">${band.min}-${band.max}Hz</text>`;
  }
  
  svg += `
  </g>
  
  <!-- Frequency Data Layer -->
  <g id="frequency-data-layer">`;
  
  // Radial frequency lines (separate rings) with band name IDs
  if (frequencyData.length > 1) {
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      let bandBaseRadius = baseRadius + bandIndex * radiusStep;
      let bandMaxRadius = baseRadius + (bandIndex + 1) * radiusStep;
      let band = frequencyBands[bandIndex];
      let bandName = `band-${bandIndex + 1}-${band.min}hz-${band.max}hz`;
      
      svg += `
    <polygon id="${bandName}" class="band-${bandIndex}" points="`;
      
      for (let i = 0; i < frequencyData.length; i++) {
        let angle = map(i, 0, frequencyData.length - 1, 0, 360) - 90;
        let amplitude = frequencyData[i].bands[bandIndex] || 0;
        let radius = map(amplitude, 0, 255, bandBaseRadius, bandMaxRadius);
        let x = centerX + cos(radians(angle)) * radius;
        let y = centerY + sin(radians(angle)) * radius;
        svg += `${x},${y} `;
      }
      
      // Close the shape
      if (frequencyData.length > 0) {
        let amplitude = frequencyData[0].bands[bandIndex] || 0;
        let radius = map(amplitude, 0, 255, bandBaseRadius, bandMaxRadius);
        let x = centerX + cos(radians(-90)) * radius;
        let y = centerY + sin(radians(-90)) * radius;
        svg += `${x},${y}`;
      }
      
      svg += `"/>`;
    }
  }
  
  svg += `
  </g>
  
  <!-- Song Title -->
  <g id="song-title-layer">
    <text x="${canvasWidth / 2}" y="${canvasHeight - 30}" text-anchor="middle" class="label" font-weight="bold" font-size="20">${currentSongName}</text>
  </g>
  
</svg>`;
  
  return svg;
}

function showAboutModal() {
  // Create modal backdrop
  let modal = createDiv('');
  modal.style('position', 'fixed');
  modal.style('top', '0');
  modal.style('left', '0');
  modal.style('width', '100%');
  modal.style('height', '100%');
  modal.style('background-color', 'rgba(0,0,0,0.5)');
  modal.style('display', 'flex');
  modal.style('justify-content', 'center');
  modal.style('align-items', 'center');
  modal.style('z-index', '1000');
  modal.id('aboutModal');
  
  // Create modal content
  let modalContent = createDiv('');
  modalContent.parent(modal);
  modalContent.style('background-color', 'white');
  modalContent.style('padding', '30px');
  modalContent.style('border-radius', '10px');
  modalContent.style('max-width', '600px');
  modalContent.style('max-height', '80%');
  modalContent.style('overflow-y', 'auto');
  modalContent.style('font-family', 'Arial, sans-serif');
  modalContent.style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');
  
  // Modal content HTML
  modalContent.html(`
    <h2 style="margin-top: 0; color: #333;">SongPlotter</h2>
    <p><strong>A tool to allow you to visualize the amplitudes of different frequencies of a song, which can then be exported to an SVG format for pen plotting</strong></p>
<p>Made by Blair Neal with Claude Code - 2025 - <a href="https://www.ablairneal.com">www.ablairneal.com</a></p>
<p>No data is stored or transmitted when using this tool. Code is available <a href="https://github.com/laserpilot/SongPlotter">on GitHub</a></

    <h3>How to Use:</h3>
    <ul>
      <li><strong>Load Audio:</strong> Use "File" to load a single audio file, or "Batch" to load multiple files for automated processing</li>
      <li><strong>Play & Record:</strong> If just a single audio file, Click "Play & Record" to start recording frequency data from your audio. If you have loaded a batch of files, click "batch"</li>
      <li><strong>Customize:</strong> Adjust frequency bands, sampling rate, smoothing, and visualization settings in the right panel</li>
      <li><strong>Export:</strong> Click "Export" to save SVG files perfect for pen plotting</li>
      <li><strong>Mute:</strong> Use the mute button to silence audio while preserving frequency analysis</li>
    </ul>
    
    <h3>Features:</h3>
    <ul>
      <li>Real-time frequency analysis with customizable bands (1-8 bands)</li>
      <li>Linear and radial visualization modes</li>
      <li>Overlay and separate band display options</li>
      <li>Logarithmic frequency scaling and amplitude normalization</li>
      <li>Batch processing for multiple audio files</li>
      <li>SVG export with organized layers and descriptive IDs</li>
      <li>A3 landscape format optimized for pen plotting</li>
    </ul>
    
    <h3>Tips:</h3>
    <ul>
      <li>Higher sampling rates capture more detail but create larger files</li>
      <li>Smoothing helps reduce noise in the visualization</li>
      <li>Turn off grid and labels for clean SVG exports</li>
      <li>Experiment with different frequency band configurations for unique visualizations</li>
    </ul>
    
    <div style="margin-top: 20px; text-align: center;">
      <button id="closeModal" style="padding: 10px 20px; font-size: 16px; border: none; background-color: #3498db; color: white; border-radius: 5px; cursor: pointer;">Close</button>
    </div>
  `);
  
  // Add close functionality
  document.getElementById('closeModal').onclick = function() {
    modal.remove();
  };
  
  // Close on backdrop click
  modal.elt.onclick = function(e) {
    if (e.target === modal.elt) {
      modal.remove();
    }
  };
}
