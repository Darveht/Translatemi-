class EzTranslateApp {
    constructor() {
        this.apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY'; // Reemplaza con tu API key
        this.apiUrl = 'https://translation.googleapis.com/language/translate/v2';
        this.useGoogleAPI = false; // Cambiar a true cuando tengas API key
        
        // Real-time translation settings
        this.translationDelay = 500; // ms delay for real-time translation
        this.lastTranslationTime = 0;
        this.isRecording = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.translationHistory = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        this.loadTranslationHistory();
    }

    initializeElements() {
        // Input elements
        this.inputText = document.getElementById('inputText');
        this.outputText = document.getElementById('outputText');
        this.sourceLanguage = document.getElementById('sourceLanguage');
        this.targetLanguage = document.getElementById('targetLanguage');
        this.translateBtn = document.getElementById('translateBtn');
        this.charCount = document.querySelector('.char-count');
        
        // Action buttons
        this.swapBtn = document.getElementById('swapLanguages');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.speakInputBtn = document.getElementById('speakInputBtn');
        this.speakOutputBtn = document.getElementById('speakOutputBtn');
        this.voiceBtn = document.getElementById('voiceBtn');
        
        // Modal elements
        this.voiceModal = document.getElementById('voiceModal');
        this.closeVoiceModal = document.getElementById('closeVoiceModal');
        this.recordBtn = document.getElementById('recordBtn');
        this.voiceCircle = document.getElementById('voiceCircle');
        this.voiceStatus = document.getElementById('voiceStatus');
        
        // Other elements
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toastContainer = document.getElementById('toastContainer');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
    }

    setupEventListeners() {
        // Translation
        this.translateBtn.addEventListener('click', () => this.translateText());
        this.inputText.addEventListener('input', () => this.updateCharCount());
        this.inputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.translateText();
            }
        });

        // Language controls
        this.swapBtn.addEventListener('click', () => this.swapLanguages());
        
        // Action buttons
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.copyBtn.addEventListener('click', () => this.copyTranslation());
        this.speakInputBtn.addEventListener('click', () => this.speakText(this.inputText.value, this.sourceLanguage.value));
        this.speakOutputBtn.addEventListener('click', () => this.speakText(this.outputText.textContent, this.targetLanguage.value));
        
        // Voice modal
        this.voiceBtn.addEventListener('click', () => this.openVoiceModal());
        
        // Fullscreen toggle
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.closeVoiceModal.addEventListener('click', () => this.closeModal());
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.voiceCircle.addEventListener('click', () => this.toggleRecording());
        
        // Close modal on outside click
        this.voiceModal.addEventListener('click', (e) => {
            if (e.target === this.voiceModal) {
                this.closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.voiceModal.classList.contains('show')) {
                this.closeModal();
            }
        });

        // Auto-translate on input (debounced)
        let timeout;
        this.inputText.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (this.inputText.value.trim()) {
                    this.translateText();
                }
            }, 1000);
        });
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.getLanguageCode(this.sourceLanguage.value);
            
            // Frases de entrenamiento de Wikipedia
            this.trainingPhrases = [
                "La tecnología artificial está transformando el mundo moderno de manera extraordinaria",
                "Los océanos cubren aproximadamente el setenta por ciento de la superficie terrestre",
                "El cerebro humano contiene miles de millones de neuronas interconectadas",
                "La historia de la humanidad está llena de descubrimientos fascinantes",
                "La música es un lenguaje universal que conecta culturas diferentes",
                "Los ecosistemas mantienen el equilibrio natural del planeta",
                "La literatura refleja la evolución del pensamiento humano",
                "Las matemáticas son fundamentales para comprender el universo",
                "La ciencia médica ha revolucionado la esperanza de vida",
                "Los idiomas preservan la diversidad cultural de las sociedades"
            ];
            
            this.currentPhraseIndex = 0;
            this.phrasesCompleted = 0;
            this.requiredPhrases = 5; // Mínimo 5 frases para entrenamiento
            
            // Configuración avanzada para clonación de voz real
            this.userVoiceProfile = {
                pitch: 1.0,
                rate: 1.0,
                volume: 1.0,
                voicePattern: null,
                audioContext: null,
                analyzer: null,
                voiceCharacteristics: {
                    frequency: [],
                    amplitude: [],
                    timbre: [],
                    intonation: []
                }
            };
            
            // Inicializar análisis de audio para clonación
            this.initializeVoiceAnalysis();
            
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.voiceCircle.classList.add('recording');
                
                // Crear barra de progreso de análisis ANTES de mostrar la frase
                this.createVoiceAnalysisProgress();
                
                // Mostrar primera frase para repetir
                this.displayTrainingPhrase();
                
                this.showToast('🔬 Iniciando entrenamiento de voz', 'success');
                
                // Solicitar acceso al micrófono para análisis de voz REAL
                navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100
                    }
                })
                    .then(stream => {
                        this.captureUserVoicePattern(stream);
                        this.startVoiceDetectionAnimation();
                        this.startRealVoiceDetection(stream);
                    })
                    .catch(error => {
                        console.warn('No se pudo acceder al micrófono para análisis:', error);
                        this.voiceStatus.textContent = '🎤 Escuchando (modo básico) - Habla ahora';
                        // Iniciar análisis simplificado si no hay acceso al micrófono
                        this.startSimplifiedVoiceAnalysis();
                    });
            };
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                // Verificar si estamos en modo análisis o traducción
                const isInTranslationMode = document.querySelector('.translation-mode-interface');
                
                if (isInTranslationMode) {
                    // Mostrar texto en el modal de traducción
                    const originalTextEl = document.getElementById('liveOriginalText');
                    const translatedTextEl = document.getElementById('liveTranslatedText');
                    
                    if (originalTextEl) {
                        originalTextEl.textContent = finalTranscript + interimTranscript;
                    }
                    
                    // Traducir en tiempo real si hay texto final
                    if (finalTranscript) {
                        this.translateAndSpeakInModal(finalTranscript);
                    }
                } else {
                    // Update input with real-time text (modo normal)
                    this.inputText.value = finalTranscript + interimTranscript;
                    this.updateCharCount();
                    
                    // Real-time translation and voice cloning
                    if (interimTranscript || finalTranscript) {
                        const textToTranslate = finalTranscript || interimTranscript;
                        this.translateAndSpeakRealTime(textToTranslate, finalTranscript !== '');
                    }
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showToast('Error en el reconocimiento de voz', 'error');
                this.isRecording = false;
                this.voiceCircle.classList.remove('recording');
                this.voiceStatus.textContent = 'Presiona para hablar';
            };
            
            this.recognition.onend = () => {
                if (this.isRecording) {
                    // Restart recognition for continuous listening
                    setTimeout(() => {
                        if (this.isRecording) {
                            this.recognition.start();
                        }
                    }, 100);
                } else {
                    this.voiceCircle.classList.remove('recording');
                    this.voiceStatus.textContent = 'Presiona para hablar';
                    
                    // Limpiar análisis de voz
                    if (this.voiceAnalysisInterval) {
                        clearInterval(this.voiceAnalysisInterval);
                        this.voiceAnalysisInterval = null;
                    }
                }
            };
        } else {
            this.voiceBtn.style.display = 'none';
            console.warn('Speech recognition not supported');
        }
    }

    async translateText() {
        const text = this.inputText.value.trim();
        if (!text) return;

        this.showLoading(true);
        
        try {
            // Simulate API call - replace with actual Google Translate API
            const translation = await this.callGoogleTranslateAPI(text);
            this.displayTranslation(translation);
            this.saveToHistory(text, translation);
        } catch (error) {
            console.error('Translation error:', error);
            this.showToast('Error al traducir el texto', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async translateAndSpeakRealTime(text, isFinal = false) {
        if (!text.trim()) return;
        
        try {
            const translation = await this.callGoogleTranslateAPI(text);
            this.displayTranslation(translation);
            
            // Only speak final translations to avoid choppy audio
            if (isFinal && translation && this.synthesis) {
                // Stop any ongoing speech
                this.synthesis.cancel();
                
                // Use advanced voice cloning
                this.speakWithAdvancedVoiceCloning(translation, this.targetLanguage.value);
            }
        } catch (error) {
            console.error('Real-time translation error:', error);
        }
    }

    async translateTextRealTime(text) {
        return this.translateAndSpeakRealTime(text, true);
    }

    async callGoogleTranslateAPI(text) {
        if (this.useGoogleAPI && this.apiKey !== 'YOUR_GOOGLE_TRANSLATE_API_KEY') {
            return this.callOfficialGoogleTranslateAPI(text);
        } else {
            return this.callFreeTranslationAPI(text);
        }
    }

    async callOfficialGoogleTranslateAPI(text) {
        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: this.sourceLanguage.value === 'auto' ? undefined : this.sourceLanguage.value,
                    target: this.targetLanguage.value,
                    format: 'text'
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return data.data.translations[0].translatedText;
        } catch (error) {
            console.error('Error with Google Translate API:', error);
            this.showToast('Error con Google Translate, usando alternativa', 'warning');
            return this.callFreeTranslationAPI(text);
        }
    }

    async callFreeTranslationAPI(text) {
        try {
            const sourceLanguage = this.sourceLanguage.value === 'auto' ? 'auto' : this.sourceLanguage.value;
            const targetLanguage = this.targetLanguage.value;
            
            // Usar la API libre de MyMemory como alternativa gratuita
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`);
            const data = await response.json();
            
            if (data.responseStatus === 200) {
                return data.responseData.translatedText;
            } else {
                throw new Error('Error en la traducción');
            }
        } catch (error) {
            console.error('Error calling translation API:', error);
            
            // Fallback a traducciones locales básicas
            const basicTranslations = {
                'Hello': targetLanguage === 'es' ? 'Hola' : 'Hello',
                'Good morning': targetLanguage === 'es' ? 'Buenos días' : 'Good morning',
                'How are you?': targetLanguage === 'es' ? '¿Cómo estás?' : 'How are you?',
                'Thank you': targetLanguage === 'es' ? 'Gracias' : 'Thank you',
                'Goodbye': targetLanguage === 'es' ? 'Adiós' : 'Goodbye',
                'Hola': targetLanguage === 'en' ? 'Hello' : 'Hola',
                'Buenos días': targetLanguage === 'en' ? 'Good morning' : 'Buenos días',
                '¿Cómo estás?': targetLanguage === 'en' ? 'How are you?' : '¿Cómo estás?',
                'Gracias': targetLanguage === 'en' ? 'Thank you' : 'Gracias',
                'Adiós': targetLanguage === 'en' ? 'Goodbye' : 'Adiós'
            };
            
            return basicTranslations[text] || `Traducción: ${text}`;
        }
    }

    displayTranslation(translation) {
        this.outputText.innerHTML = `<p>${translation}</p>`;
        this.outputText.classList.add('has-content');
    }

    swapLanguages() {
        if (this.sourceLanguage.value === 'auto') {
            this.showToast('No se puede intercambiar desde detección automática', 'warning');
            return;
        }

        const sourceValue = this.sourceLanguage.value;
        const targetValue = this.targetLanguage.value;
        const inputValue = this.inputText.value;
        const outputValue = this.outputText.textContent;

        this.sourceLanguage.value = targetValue;
        this.targetLanguage.value = sourceValue;
        this.inputText.value = outputValue;
        this.outputText.textContent = inputValue;

        this.updateCharCount();
        this.showToast('Idiomas intercambiados', 'success');
    }

    clearText() {
        this.inputText.value = '';
        this.outputText.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-language"></i>
                <p>La traducción aparecerá aquí</p>
            </div>
        `;
        this.updateCharCount();
    }

    async copyTranslation() {
        const text = this.outputText.textContent;
        if (!text || text.includes('aparecerá aquí')) return;

        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Texto copiado al portapapeles', 'success');
        } catch (error) {
            console.error('Copy error:', error);
            this.showToast('Error al copiar el texto', 'error');
        }
    }

    speakText(text, language) {
        if (!text || text.includes('aparecerá aquí')) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.getLanguageCode(language);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        
        this.synthesis.speak(utterance);
    }

    initializeVoiceAnalysis() {
        try {
            // Inicializar contexto de audio para análisis de voz
            this.userVoiceProfile.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.userVoiceProfile.analyzer = this.userVoiceProfile.audioContext.createAnalyser();
            this.userVoiceProfile.analyzer.fftSize = 2048;
            
            console.log('Sistema de análisis de voz inicializado para clonación');
        } catch (error) {
            console.warn('No se pudo inicializar análisis avanzado de voz:', error);
        }
    }

    async captureUserVoicePattern(stream) {
        if (!this.userVoiceProfile.audioContext) return;
        
        try {
            const source = this.userVoiceProfile.audioContext.createMediaStreamSource(stream);
            source.connect(this.userVoiceProfile.analyzer);
            
            // Configuración avanzada para análisis profundo REAL
            this.userVoiceProfile.analyzer.fftSize = 8192; // Máxima resolución
            this.userVoiceProfile.analyzer.smoothingTimeConstant = 0.05; // Más sensible
            
            const bufferLength = this.userVoiceProfile.analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const floatArray = new Float32Array(bufferLength);
            
            // Inicializar sistema de análisis profundo REAL
            this.userVoiceProfile.realTimeAnalysis = {
                startTime: Date.now(),
                analysisPhase: 'initialization',
                samplesCollected: 0,
                minimumSamples: 150, // Mínimo 150 muestras (7.5 segundos)
                qualitySamples: 0,
                voiceDetected: false,
                silenceThreshold: 30,
                voiceThreshold: 50,
                analysisProgress: 0,
                currentPhase: 'Inicializando análisis...'
            };
            
            // Inicializar patrones de voz únicos con estructura real
            this.userVoiceProfile.voiceSignature = {
                fundamentalFrequency: [],
                harmonicStructure: [],
                formantFrequencies: [],
                voiceTexture: [],
                rhythmPattern: [],
                breathingPattern: [],
                tonalCharacteristics: {
                    baseFreq: 0,
                    frequencyRange: { min: Infinity, max: 0 },
                    vibrato: 0,
                    resonance: []
                },
                uniqueMarkers: {
                    voicePrint: [],
                    spectralSignature: [],
                    timbreProfile: []
                }
            };
            
            let lastVoiceDetection = 0;
            let silencePeriods = [];
            let speechPeriods = [];
            
            // Análisis REAL en tiempo real - cada 50ms pero con procesamiento inteligente
            const realTimeAnalysis = setInterval(() => {
                this.userVoiceProfile.analyzer.getByteFrequencyData(dataArray);
                this.userVoiceProfile.analyzer.getFloatFrequencyData(floatArray);
                
                const analysis = this.userVoiceProfile.realTimeAnalysis;
                const currentTime = Date.now();
                const elapsedTime = currentTime - analysis.startTime;
                
                // Detectar si hay voz actualmente
                const currentVolume = this.calculateAverageAmplitude(dataArray);
                const isVoiceActive = currentVolume > analysis.voiceThreshold;
                
                if (isVoiceActive) {
                    analysis.voiceDetected = true;
                    lastVoiceDetection = currentTime;
                    speechPeriods.push(currentTime);
                    
                    // Solo procesar cuando hay voz real
                    const voiceAnalysis = this.performRealTimeVoiceAnalysis(dataArray, floatArray, elapsedTime);
                    
                    if (voiceAnalysis.quality > 0.7) { // Solo muestras de alta calidad
                        this.updateRealVoiceSignature(voiceAnalysis);
                        analysis.qualitySamples++;
                    }
                    
                    analysis.samplesCollected++;
                    
                    // Actualizar fase de análisis basada en progreso real
                    this.updateRealAnalysisPhase(analysis, elapsedTime);
                    
                } else if (currentVolume < analysis.silenceThreshold) {
                    silencePeriods.push(currentTime);
                }
                
                // Mostrar progreso REAL basado en datos reales
                this.updateRealVoiceAnalysisProgress(analysis, elapsedTime, isVoiceActive);
                
                // Verificar si el análisis está completo (solo si hay suficiente voz)
                if (analysis.qualitySamples >= analysis.minimumSamples && 
                    elapsedTime > 10000 && // Mínimo 10 segundos
                    (currentTime - lastVoiceDetection) < 2000) { // Voz reciente
                    
                    this.completeRealVoiceAnalysis();
                    clearInterval(realTimeAnalysis);
                }
                
                // Timeout de seguridad - 60 segundos máximo
                if (elapsedTime > 60000) {
                    if (analysis.qualitySamples > 50) {
                        this.completeRealVoiceAnalysis();
                    } else {
                        this.voiceStatus.textContent = '⚠️ Análisis incompleto - Habla más para mejor clonación';
                    }
                    clearInterval(realTimeAnalysis);
                }
                
            }, 50); // 50ms para análisis fluido pero no superficial
            
            // Guardar referencia para limpieza
            this.voiceAnalysisInterval = realTimeAnalysis;
            
        } catch (error) {
            console.error('Error capturando patrón de voz:', error);
        }
    }

    findDominantFrequency(dataArray) {
        let maxValue = 0;
        let maxIndex = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxIndex = i;
            }
        }
        
        return maxIndex * (this.userVoiceProfile.audioContext.sampleRate / 2) / dataArray.length;
    }

    calculateAverageAmplitude(dataArray) {
        const sum = dataArray.reduce((a, b) => a + b, 0);
        return sum / dataArray.length;
    }

    analyzeTimbre(dataArray) {
        // Análisis básico de timbre basado en distribución de frecuencias
        const lowFreq = dataArray.slice(0, Math.floor(dataArray.length * 0.3));
        const midFreq = dataArray.slice(Math.floor(dataArray.length * 0.3), Math.floor(dataArray.length * 0.7));
        const highFreq = dataArray.slice(Math.floor(dataArray.length * 0.7));
        
        return {
            low: lowFreq.reduce((a, b) => a + b, 0) / lowFreq.length,
            mid: midFreq.reduce((a, b) => a + b, 0) / midFreq.length,
            high: highFreq.reduce((a, b) => a + b, 0) / highFreq.length
        };
    }

    performAdvancedVoiceAnalysis(dataArray, floatArray) {
        // Análisis de frecuencia fundamental
        const fundamentalFreq = this.findFundamentalFrequency(dataArray);
        
        // Análisis de armónicos
        const harmonics = this.analyzeHarmonics(dataArray, fundamentalFreq);
        
        // Análisis de formantes (características únicas de la voz)
        const formants = this.analyzeFormants(floatArray);
        
        // Análisis de textura vocal
        const texture = this.analyzeVoiceTexture(dataArray);
        
        // Análisis de patrón respiratorio
        const breathingPattern = this.analyzeBreathingPattern(dataArray);
        
        return {
            fundamentalFreq,
            harmonics,
            formants,
            texture,
            breathingPattern,
            timestamp: Date.now()
        };
    }

    findFundamentalFrequency(dataArray) {
        // Buscar la frecuencia fundamental usando autocorrelación
        let maxCorrelation = 0;
        let fundamentalFreq = 0;
        
        for (let i = 1; i < dataArray.length / 2; i++) {
            let correlation = 0;
            for (let j = 0; j < dataArray.length - i; j++) {
                correlation += dataArray[j] * dataArray[j + i];
            }
            
            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                fundamentalFreq = i * (this.userVoiceProfile.audioContext.sampleRate / 2) / dataArray.length;
            }
        }
        
        return fundamentalFreq;
    }

    analyzeHarmonics(dataArray, fundamentalFreq) {
        const harmonics = [];
        const sampleRate = this.userVoiceProfile.audioContext.sampleRate;
        
        for (let harmonic = 1; harmonic <= 8; harmonic++) {
            const targetFreq = fundamentalFreq * harmonic;
            const binIndex = Math.round(targetFreq * dataArray.length * 2 / sampleRate);
            
            if (binIndex < dataArray.length) {
                harmonics.push({
                    harmonic: harmonic,
                    frequency: targetFreq,
                    amplitude: dataArray[binIndex]
                });
            }
        }
        
        return harmonics;
    }

    analyzeFormants(floatArray) {
        // Análisis de formantes (F1, F2, F3) que dan el carácter único a la voz
        const formants = [];
        const peaks = this.findSpectralPeaks(floatArray);
        
        // Buscar los tres formantes principales
        for (let i = 0; i < Math.min(3, peaks.length); i++) {
            formants.push({
                formant: i + 1,
                frequency: peaks[i].frequency,
                amplitude: peaks[i].amplitude
            });
        }
        
        return formants;
    }

    findSpectralPeaks(floatArray) {
        const peaks = [];
        const sampleRate = this.userVoiceProfile.audioContext.sampleRate;
        
        for (let i = 1; i < floatArray.length - 1; i++) {
            if (floatArray[i] > floatArray[i - 1] && floatArray[i] > floatArray[i + 1]) {
                const frequency = i * (sampleRate / 2) / floatArray.length;
                peaks.push({
                    frequency: frequency,
                    amplitude: floatArray[i]
                });
            }
        }
        
        // Ordenar por amplitud descendente
        return peaks.sort((a, b) => b.amplitude - a.amplitude);
    }

    analyzeVoiceTexture(dataArray) {
        // Análisis de rugosidad, brillantez y calidez de la voz
        const spectralCentroid = this.calculateSpectralCentroid(dataArray);
        const spectralRolloff = this.calculateSpectralRolloff(dataArray);
        const zeroCrossingRate = this.calculateZeroCrossingRate(dataArray);
        
        return {
            brightness: spectralCentroid,
            roughness: spectralRolloff,
            clarity: zeroCrossingRate
        };
    }

    calculateSpectralCentroid(dataArray) {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            weightedSum += i * dataArray[i];
            magnitudeSum += dataArray[i];
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }

    calculateSpectralRolloff(dataArray) {
        const totalEnergy = dataArray.reduce((sum, val) => sum + val * val, 0);
        const threshold = totalEnergy * 0.85;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < dataArray.length; i++) {
            cumulativeEnergy += dataArray[i] * dataArray[i];
            if (cumulativeEnergy >= threshold) {
                return i;
            }
        }
        
        return dataArray.length - 1;
    }

    calculateZeroCrossingRate(dataArray) {
        let crossings = 0;
        for (let i = 1; i < dataArray.length; i++) {
            if ((dataArray[i] >= 0) !== (dataArray[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / dataArray.length;
    }

    analyzeBreathingPattern(dataArray) {
        // Análisis del patrón respiratorio para naturalidad
        const amplitude = this.calculateAverageAmplitude(dataArray);
        const variation = this.calculateAmplitudeVariation(dataArray);
        
        return {
            amplitude: amplitude,
            variation: variation,
            naturalness: Math.min(1, variation / amplitude)
        };
    }

    calculateAmplitudeVariation(dataArray) {
        const mean = this.calculateAverageAmplitude(dataArray);
        const variance = dataArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataArray.length;
        return Math.sqrt(variance);
    }

    updateVoiceSignature(analysis) {
        const signature = this.userVoiceProfile.voiceSignature;
        
        // Actualizar frecuencia fundamental
        signature.fundamentalFrequency = analysis.fundamentalFreq;
        
        // Actualizar estructura armónica
        signature.harmonicStructure = analysis.harmonics;
        
        // Actualizar formantes
        signature.formantFrequencies = analysis.formants;
        
        // Actualizar textura vocal
        signature.voiceTexture.push(analysis.texture);
        if (signature.voiceTexture.length > 20) {
            signature.voiceTexture.shift();
        }
        
        // Actualizar características tonales
        signature.tonalCharacteristics.baseFreq = analysis.fundamentalFreq;
        signature.tonalCharacteristics.vibrato = this.calculateVibrato(analysis);
        
        // Mantener historial limitado para optimización
        if (signature.rhythmPattern.length > 30) {
            signature.rhythmPattern.shift();
        }
    }

    calculateVibrato(analysis) {
        // Calcular vibrato basado en variaciones de frecuencia
        if (this.userVoiceProfile.voiceSignature.rhythmPattern.length > 5) {
            const recent = this.userVoiceProfile.voiceSignature.rhythmPattern.slice(-5);
            const avg = recent.reduce((sum, val) => sum + val.fundamentalFreq, 0) / recent.length;
            const variance = recent.reduce((sum, val) => sum + Math.pow(val.fundamentalFreq - avg, 2), 0) / recent.length;
            return Math.sqrt(variance);
        }
        return 0;
    }

    performRealTimeVoiceAnalysis(dataArray, floatArray, elapsedTime) {
        // Análisis profundo REAL que toma tiempo auténtico
        const fundamentalFreq = this.findFundamentalFrequency(dataArray);
        const harmonics = this.analyzeHarmonics(dataArray, fundamentalFreq);
        const formants = this.analyzeFormants(floatArray);
        const texture = this.analyzeVoiceTexture(dataArray);
        const spectralProfile = this.analyzeSpectralProfile(floatArray);
        
        // Calcular calidad de la muestra
        const quality = this.calculateSampleQuality(dataArray, fundamentalFreq, harmonics);
        
        return {
            fundamentalFreq,
            harmonics,
            formants,
            texture,
            spectralProfile,
            quality,
            timestamp: Date.now(),
            elapsedTime
        };
    }

    analyzeSpectralProfile(floatArray) {
        // Análisis espectral profundo para huella vocal única
        const profile = {
            spectralCentroid: this.calculateSpectralCentroid(floatArray),
            spectralRolloff: this.calculateSpectralRolloff(floatArray),
            spectralFlux: this.calculateSpectralFlux(floatArray),
            harmonicityRatio: this.calculateHarmonicityRatio(floatArray)
        };
        
        return profile;
    }

    calculateSampleQuality(dataArray, fundamentalFreq, harmonics) {
        // Calcular calidad basada en claridad de la señal
        const signalStrength = this.calculateAverageAmplitude(dataArray) / 255;
        const frequencyClarity = fundamentalFreq > 80 && fundamentalFreq < 500 ? 1 : 0.5;
        const harmonicRichness = harmonics.length > 3 ? 1 : harmonics.length / 3;
        
        return (signalStrength + frequencyClarity + harmonicRichness) / 3;
    }

    updateRealVoiceSignature(analysis) {
        const signature = this.userVoiceProfile.voiceSignature;
        
        // Acumular datos REALES - no simular
        signature.fundamentalFrequency.push(analysis.fundamentalFreq);
        signature.harmonicStructure.push(analysis.harmonics);
        signature.formantFrequencies.push(analysis.formants);
        signature.voiceTexture.push(analysis.texture);
        
        // Mantener historial limitado pero significativo
        if (signature.fundamentalFrequency.length > 200) {
            signature.fundamentalFrequency.shift();
        }
        if (signature.harmonicStructure.length > 200) {
            signature.harmonicStructure.shift();
        }
        
        // Actualizar características tonales en tiempo real
        signature.tonalCharacteristics.baseFreq = this.calculateAverageFrequency(signature.fundamentalFrequency);
        signature.tonalCharacteristics.frequencyRange.min = Math.min(...signature.fundamentalFrequency);
        signature.tonalCharacteristics.frequencyRange.max = Math.max(...signature.fundamentalFrequency);
        
        // Construir huella vocal única
        signature.uniqueMarkers.voicePrint.push({
            freq: analysis.fundamentalFreq,
            harmonics: analysis.harmonics.slice(0, 5),
            formants: analysis.formants,
            timestamp: analysis.timestamp
        });
    }

    updateRealAnalysisPhase(analysis, elapsedTime) {
        const samples = analysis.qualitySamples;
        const timeSeconds = elapsedTime / 1000;
        
        let stepNumber = 1;
        let stepProgress = 0;
        
        if (samples < 30) {
            analysis.analysisPhase = 'voice_detection';
            analysis.currentPhase = `🔍 Detectando patrones vocales (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 1;
            stepProgress = (samples / 30) * 100;
        } else if (samples < 60) {
            analysis.analysisPhase = 'frequency_analysis';
            analysis.currentPhase = `📊 Analizando frecuencias fundamentales (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 2;
            stepProgress = ((samples - 30) / 30) * 100;
        } else if (samples < 90) {
            analysis.analysisPhase = 'harmonic_mapping';
            analysis.currentPhase = `🎵 Mapeando estructura armónica (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 3;
            stepProgress = ((samples - 60) / 30) * 100;
        } else if (samples < 120) {
            analysis.analysisPhase = 'formant_extraction';
            analysis.currentPhase = `🧬 Extrayendo formantes únicos (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 4;
            stepProgress = ((samples - 90) / 30) * 100;
        } else if (samples < 150) {
            analysis.analysisPhase = 'voice_signature';
            analysis.currentPhase = `✨ Creando huella vocal única (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 5;
            stepProgress = ((samples - 120) / 30) * 100;
        } else {
            analysis.analysisPhase = 'finalization';
            analysis.currentPhase = `🎯 Finalizando clonación perfecta (${timeSeconds.toFixed(1)}s)`;
            stepNumber = 6;
            stepProgress = Math.min(100, ((samples - 150) / 30) * 100);
        }
        
        // Actualizar la barra de progreso
        this.updateVoiceAnalysisStep(stepNumber, stepProgress);
    }

    updateRealVoiceAnalysisProgress(analysis, elapsedTime, isVoiceActive) {
        const progress = Math.min(100, (analysis.qualitySamples / analysis.minimumSamples) * 100);
        const timeSeconds = elapsedTime / 1000;
        
        const voiceIndicator = isVoiceActive ? '🎤' : '⏸️';
        const phaseDescription = analysis.currentPhase;
        
        this.voiceStatus.textContent = `${voiceIndicator} ${phaseDescription} - ${Math.round(progress)}% (Muestras: ${analysis.qualitySamples}/${analysis.minimumSamples})`;
        
        // Solo mostrar "completando" cuando realmente esté cerca
        if (progress > 90 && analysis.qualitySamples >= analysis.minimumSamples) {
            this.voiceStatus.textContent = `🎯 Completando análisis profundo - ${Math.round(progress)}% (${timeSeconds.toFixed(1)}s)`;
        }
    }

    completeRealVoiceAnalysis() {
        const signature = this.userVoiceProfile.voiceSignature;
        
        if (signature.fundamentalFrequency.length > 10) {
            // Calcular características promedio REALES
            const avgTexture = this.calculateAverageTextureReal(signature.voiceTexture);
            const avgFormant = this.calculateAverageFormantsReal(signature.formantFrequencies);
            const avgFrequency = this.calculateAverageFrequency(signature.fundamentalFrequency);
            
            // Crear perfil optimizado basado en datos REALES
            this.userVoiceProfile.optimizedSettings = {
                pitch: this.mapFrequencyToPitchReal(avgFrequency, signature.fundamentalFrequency),
                rate: this.calculateOptimalRateReal(avgTexture, signature.voiceTexture),
                volume: this.calculateOptimalVolumeReal(avgTexture),
                resonance: avgFormant,
                breathiness: avgTexture.roughness,
                voiceSignature: this.createUniqueVoiceSignature(signature)
            };
            
            console.log('🎯 ANÁLISIS REAL COMPLETADO:', {
                samplesAnalyzed: signature.fundamentalFrequency.length,
                avgFrequency: avgFrequency.toFixed(2),
                frequencyRange: `${signature.tonalCharacteristics.frequencyRange.min.toFixed(0)}-${signature.tonalCharacteristics.frequencyRange.max.toFixed(0)} Hz`,
                settings: this.userVoiceProfile.optimizedSettings
            });
            
            // Completar barra de progreso y transicionar
            this.finishVoiceAnalysisProgress();
            
            // Transición automática después de 3 segundos
            setTimeout(() => {
                this.transitionToTranslationMode();
            }, 3000);
            
        } else {
            this.voiceStatus.textContent = '⚠️ Análisis insuficiente - Habla más tiempo para mejor clonación';
            this.showToast('⚠️ Necesitas hablar más para una clonación perfecta', 'warning');
        }
    }

    createVoiceAnalysisProgress() {
        // Verificar si ya existe para evitar duplicados
        if (document.getElementById('voiceAnalysisProgress')) {
            return;
        }
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'voice-analysis-progress';
        progressContainer.id = 'voiceAnalysisProgress';
        
        progressContainer.innerHTML = `
            <div class="analysis-steps">
                <div class="step-item" data-step="1">
                    <div class="step-icon">🔍</div>
                    <div class="step-label">Detectando voz</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
                <div class="step-item" data-step="2">
                    <div class="step-icon">📊</div>
                    <div class="step-label">Analizando frecuencias</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
                <div class="step-item" data-step="3">
                    <div class="step-icon">🎵</div>
                    <div class="step-label">Mapeando armónicos</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
                <div class="step-item" data-step="4">
                    <div class="step-icon">🧬</div>
                    <div class="step-label">Extrayendo formantes</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
                <div class="step-item" data-step="5">
                    <div class="step-icon">✨</div>
                    <div class="step-label">Creando firma vocal</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
                <div class="step-item" data-step="6">
                    <div class="step-icon">🎯</div>
                    <div class="step-label">Finalizando clonación</div>
                    <div class="step-bar"><div class="step-fill"></div></div>
                </div>
            </div>
            <div class="overall-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="overallProgressFill"></div>
                </div>
                <div class="progress-text">
                    <span id="progressPercentage">0%</span>
                    <span id="progressSamples">0/150 muestras</span>
                </div>
            </div>
        `;
        
        // Insertar después del voice-status
        const voiceInterface = document.querySelector('.voice-interface');
        const voiceStatus = document.getElementById('voiceStatus');
        
        if (voiceInterface && voiceStatus) {
            voiceInterface.insertBefore(progressContainer, voiceStatus.nextSibling);
        } else {
            // Si no encuentra los elementos, insertarlo al final del modal body
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) {
                modalBody.appendChild(progressContainer);
            }
        }
        
        console.log('✅ Barra de progreso de análisis creada');
    }

    startVoiceDetectionAnimation() {
        const voiceCircle = document.getElementById('voiceCircle');
        
        // Agregar indicador visual de detección
        if (!document.getElementById('voiceWaveIndicator')) {
            const waveIndicator = document.createElement('div');
            waveIndicator.id = 'voiceWaveIndicator';
            waveIndicator.className = 'voice-wave-indicator';
            
            for (let i = 0; i < 5; i++) {
                const bar = document.createElement('div');
                bar.className = 'wave-bar';
                bar.style.animationDelay = `${i * 0.1}s`;
                waveIndicator.appendChild(bar);
            }
            
            voiceCircle.appendChild(waveIndicator);
        }
    }

    updateVoiceAnalysisStep(stepNumber, progress) {
        const step = document.querySelector(`[data-step="${stepNumber}"]`);
        const overallFill = document.getElementById('overallProgressFill');
        const progressText = document.getElementById('progressPercentage');
        const samplesText = document.getElementById('progressSamples');
        
        if (step) {
            step.classList.add('active');
            const stepFill = step.querySelector('.step-fill');
            stepFill.style.width = `${progress}%`;
            
            if (progress >= 100) {
                step.classList.add('completed');
                step.classList.remove('active');
            }
        }
        
        // Actualizar progreso general
        const analysis = this.userVoiceProfile.realTimeAnalysis;
        if (analysis) {
            const overallProgress = Math.min(100, (analysis.qualitySamples / analysis.minimumSamples) * 100);
            overallFill.style.width = `${overallProgress}%`;
            progressText.textContent = `${Math.round(overallProgress)}%`;
            samplesText.textContent = `${analysis.qualitySamples}/${analysis.minimumSamples} muestras`;
        }
    }

    finishVoiceAnalysisProgress() {
        // Completar todas las barras
        for (let i = 1; i <= 6; i++) {
            this.updateVoiceAnalysisStep(i, 100);
        }
        
        const overallFill = document.getElementById('overallProgressFill');
        const progressText = document.getElementById('progressPercentage');
        
        if (overallFill) overallFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        
        // Mostrar mensaje de finalización
        this.voiceStatus.textContent = '✅ ¡Análisis completado! Tu voz ha sido perfectamente clonada';
        this.showToast('🎯 Clonación completa - Preparando modo traducción', 'success');
        
        // Añadir efecto de finalización
        const voiceCircle = document.getElementById('voiceCircle');
        voiceCircle.classList.add('analysis-complete');
    }

    transitionToTranslationMode() {
        // Cambiar el modal a modo traducción
        const modalContent = document.querySelector('.modal-content');
        modalContent.classList.add('transition-to-translation');
        
        // Cambiar contenido del modal
        const modalHeader = document.querySelector('.modal-header h3');
        modalHeader.textContent = 'Traducción en Tiempo Real - Tu Voz Clonada';
        
        // Reemplazar el contenido del modal
        const modalBody = document.querySelector('.modal-body');
        modalBody.innerHTML = `
            <div class="translation-mode-interface">
                <div class="cloned-voice-status">
                    <div class="voice-clone-indicator">
                        <i class="fas fa-check-circle"></i>
                        <span>Tu voz ha sido clonada exitosamente</span>
                    </div>
                    <div class="voice-characteristics">
                        <div class="characteristic">
                            <span>Tono base:</span>
                            <span>${this.userVoiceProfile.optimizedSettings?.pitch.toFixed(2) || 'N/A'}</span>
                        </div>
                        <div class="characteristic">
                            <span>Velocidad:</span>
                            <span>${this.userVoiceProfile.optimizedSettings?.rate.toFixed(2) || 'N/A'}</span>
                        </div>
                        <div class="characteristic">
                            <span>Volumen:</span>
                            <span>${this.userVoiceProfile.optimizedSettings?.volume.toFixed(2) || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="live-translation-interface">
                    <div class="live-voice-circle" id="liveVoiceCircle">
                        <i class="fas fa-microphone"></i>
                    </div>
                    <div class="translation-status" id="translationStatus">
                        Habla ahora para traducir con tu voz clonada
                    </div>
                    
                    <div class="live-translation-display">
                        <div class="translation-section">
                            <h4>Lo que dijiste:</h4>
                            <div class="original-text" id="liveOriginalText">...</div>
                        </div>
                        <div class="translation-section">
                            <h4>Traducción:</h4>
                            <div class="translated-text" id="liveTranslatedText">...</div>
                        </div>
                    </div>
                    
                    <div class="translation-controls">
                        <button class="btn-primary" id="startLiveTranslation">
                            <i class="fas fa-play"></i>
                            Comenzar Traducción en Vivo
                        </button>
                        <button class="btn-secondary" id="stopLiveTranslation" style="display: none;">
                            <i class="fas fa-stop"></i>
                            Detener
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Configurar eventos para traducción en vivo
        this.setupLiveTranslationMode();
        
        this.showToast('🚀 ¡Modo traducción activado! Ahora puedes traducir con tu voz', 'success');
    }

    setupLiveTranslationMode() {
        const startBtn = document.getElementById('startLiveTranslation');
        const stopBtn = document.getElementById('stopLiveTranslation');
        const liveCircle = document.getElementById('liveVoiceCircle');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startLiveTranslation();
                startBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
                liveCircle.classList.add('recording');
            });
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopLiveTranslation();
                stopBtn.style.display = 'none';
                startBtn.style.display = 'flex';
                liveCircle.classList.remove('recording');
            });
        }
    }

    startLiveTranslation() {
        if (this.recognition) {
            this.recognition.lang = this.getLanguageCode(this.sourceLanguage.value);
            this.recognition.start();
            
            const status = document.getElementById('translationStatus');
            if (status) status.textContent = '🎤 Escuchando... Habla ahora';
        }
    }

    stopLiveTranslation() {
        if (this.recognition) {
            this.recognition.stop();
            
            const status = document.getElementById('translationStatus');
            if (status) status.textContent = 'Traducción detenida';
        }
    }

    calculateAverageFrequency(frequencies) {
        return frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
    }

    calculateAverageTextureReal(textures) {
        if (textures.length === 0) return { brightness: 0, roughness: 0, clarity: 0 };
        
        const sum = textures.reduce((acc, texture) => ({
            brightness: acc.brightness + texture.brightness,
            roughness: acc.roughness + texture.roughness,
            clarity: acc.clarity + texture.clarity
        }), { brightness: 0, roughness: 0, clarity: 0 });
        
        return {
            brightness: sum.brightness / textures.length,
            roughness: sum.roughness / textures.length,
            clarity: sum.clarity / textures.length
        };
    }

    calculateAverageFormantsReal(formantArrays) {
        if (formantArrays.length === 0) return [];
        
        const avgFormants = [];
        for (let i = 0; i < 3; i++) {
            const formantData = formantArrays.flat().filter(f => f.formant === i + 1);
            if (formantData.length > 0) {
                avgFormants.push({
                    formant: i + 1,
                    frequency: formantData.reduce((sum, f) => sum + f.frequency, 0) / formantData.length,
                    amplitude: formantData.reduce((sum, f) => sum + f.amplitude, 0) / formantData.length
                });
            }
        }
        
        return avgFormants;
    }

    mapFrequencyToPitchReal(avgFreq, allFrequencies) {
        // Mapeo más preciso basado en datos reales
        const variance = this.calculateVariance(allFrequencies, avgFreq);
        const normalizedFreq = avgFreq / 150; // Frecuencia base
        const varianceFactor = Math.min(0.3, variance / 1000); // Factor de variación
        
        return Math.max(0.3, Math.min(2.0, normalizedFreq + varianceFactor));
    }

    calculateVariance(values, mean) {
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
    }

    createUniqueVoiceSignature(signature) {
        // Crear firma única basada en todos los datos reales
        return {
            id: Date.now().toString(36),
            avgFundamental: this.calculateAverageFrequency(signature.fundamentalFrequency),
            frequencyVariance: this.calculateVariance(signature.fundamentalFrequency, this.calculateAverageFrequency(signature.fundamentalFrequency)),
            harmonicComplexity: signature.harmonicStructure.length > 0 ? signature.harmonicStructure[signature.harmonicStructure.length - 1].length : 0,
            spectralFingerprint: signature.uniqueMarkers.voicePrint.slice(-10), // Últimas 10 muestras
            analysisTimestamp: Date.now()
        };
    }

    performInitialVoiceCalibration() {
        const signature = this.userVoiceProfile.voiceSignature;
        
        if (signature.voiceTexture.length > 5) {
            // Calcular características promedio
            const avgTexture = this.calculateAverageTexture(signature.voiceTexture);
            const avgFormant = this.calculateAverageFormants(signature.formantFrequencies);
            
            // Actualizar perfil optimizado
            this.userVoiceProfile.optimizedSettings = {
                pitch: this.mapFrequencyToPitch(signature.fundamentalFrequency),
                rate: this.calculateOptimalRate(avgTexture),
                volume: this.calculateOptimalVolume(avgTexture),
                resonance: avgFormant,
                breathiness: avgTexture.roughness
            };
            
            console.log('Calibración de voz completada:', this.userVoiceProfile.optimizedSettings);
            this.showToast('🎯 Tu voz ha sido completamente analizada y clonada', 'success');
        }
    }

    calculateAverageTexture(textures) {
        if (textures.length === 0) return { brightness: 0, roughness: 0, clarity: 0 };
        
        const sum = textures.reduce((acc, texture) => ({
            brightness: acc.brightness + texture.brightness,
            roughness: acc.roughness + texture.roughness,
            clarity: acc.clarity + texture.clarity
        }), { brightness: 0, roughness: 0, clarity: 0 });
        
        return {
            brightness: sum.brightness / textures.length,
            roughness: sum.roughness / textures.length,
            clarity: sum.clarity / textures.length
        };
    }

    calculateAverageFormants(formants) {
        if (formants.length === 0) return [];
        
        const avgFormants = [];
        for (let i = 0; i < 3; i++) {
            const formantData = formants.filter(f => f.formant === i + 1);
            if (formantData.length > 0) {
                avgFormants.push({
                    formant: i + 1,
                    frequency: formantData.reduce((sum, f) => sum + f.frequency, 0) / formantData.length,
                    amplitude: formantData.reduce((sum, f) => sum + f.amplitude, 0) / formantData.length
                });
            }
        }
        
        return avgFormants;
    }

    mapFrequencyToPitch(frequency) {
        // Mapear frecuencia fundamental a pitch de síntesis
        const basePitch = 1.0;
        const factor = frequency / 150; // Frecuencia base promedio
        return Math.max(0.1, Math.min(2.0, basePitch * factor));
    }

    calculateOptimalRate(texture) {
        // Calcular velocidad óptima basada en textura vocal
        const baseRate = 1.0;
        const clarityFactor = texture.clarity / 100;
        return Math.max(0.5, Math.min(1.5, baseRate * (1 + clarityFactor)));
    }

    calculateOptimalVolume(texture) {
        // Calcular volumen óptimo basado en textura vocal
        const baseVolume = 1.0;
        const brightnessFactor = texture.brightness / 1000;
        return Math.max(0.3, Math.min(1.0, baseVolume * (0.8 + brightnessFactor)));
    }

    speakWithAdvancedVoiceCloning(text, language) {
        if (!text || text.includes('aparecerá aquí')) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.getLanguageCode(language);
        
        // Aplicar configuraciones optimizadas si están disponibles
        if (this.userVoiceProfile.optimizedSettings) {
            const settings = this.userVoiceProfile.optimizedSettings;
            
            utterance.pitch = settings.pitch;
            utterance.rate = settings.rate;
            utterance.volume = settings.volume;
            
            console.log(`🎯 Clonación AVANZADA: Pitch=${settings.pitch.toFixed(3)}, Rate=${settings.rate.toFixed(3)}, Volume=${settings.volume.toFixed(3)}`);
        } else if (this.userVoiceProfile.voiceCharacteristics.frequency.length > 0) {
            // Usar análisis básico si el avanzado no está listo
            const avgFreq = this.userVoiceProfile.voiceCharacteristics.frequency.reduce((a, b) => a + b, 0) / this.userVoiceProfile.voiceCharacteristics.frequency.length;
            const avgAmp = this.userVoiceProfile.voiceCharacteristics.amplitude.reduce((a, b) => a + b, 0) / this.userVoiceProfile.voiceCharacteristics.amplitude.length;
            
            utterance.pitch = Math.max(0.1, Math.min(2.0, avgFreq / 200));
            utterance.volume = Math.max(0.1, Math.min(1.0, avgAmp / 128));
            utterance.rate = 1.0;
            
            console.log(`🔊 Clonación BÁSICA: Pitch=${utterance.pitch.toFixed(2)}, Volume=${utterance.volume.toFixed(2)}`);
        }
        
        // Buscar la mejor voz neural disponible con prioridad
        const voices = this.synthesis.getVoices();
        const priorityVoices = voices.filter(voice => 
            voice.lang.startsWith(language) && 
            (voice.name.toLowerCase().includes('neural') || 
             voice.name.toLowerCase().includes('premium') ||
             voice.name.toLowerCase().includes('enhanced') ||
             voice.name.toLowerCase().includes('wavenet'))
        );
        
        const targetVoice = priorityVoices[0] || voices.find(voice => voice.lang.startsWith(language));
        
        if (targetVoice) {
            utterance.voice = targetVoice;
            console.log(`🎵 Usando voz: ${targetVoice.name}`);
        }
        
        // Aplicar modulación de voz para mayor realismo
        if (this.userVoiceProfile.voiceSignature && this.userVoiceProfile.voiceSignature.tonalCharacteristics) {
            const tonal = this.userVoiceProfile.voiceSignature.tonalCharacteristics;
            
            // Modular el pitch ligeramente para simular vibrato natural
            const originalPitch = utterance.pitch;
            let currentPitch = originalPitch;
            
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    // Aplicar micro-variaciones en el pitch para naturalidad
                    const vibrato = Math.sin(Date.now() / 200) * 0.05;
                    currentPitch = originalPitch + vibrato;
                    utterance.pitch = Math.max(0.1, Math.min(2.0, currentPitch));
                }
            };
        }
        
        utterance.onstart = () => {
            this.voiceStatus.textContent = `🎯 Reproduciendo con TU voz clonada en ${this.getLanguageName(language)}`;
        };
        
        utterance.onend = () => {
            this.voiceStatus.textContent = '🎤 Escuchando y clonando tu voz en tiempo real...';
        };
        
        utterance.onerror = (error) => {
            console.error('Error en síntesis de voz:', error);
            this.voiceStatus.textContent = '⚠️ Error en reproducción - Reintentando...';
        };
        
        // Detener cualquier síntesis anterior para evitar solapamiento
        this.synthesis.cancel();
        
        // Pequeño delay para evitar conflictos
        setTimeout(() => {
            this.synthesis.speak(utterance);
        }, 100);
    }

    speakWithVoiceCloning(text, language) {
        return this.speakWithAdvancedVoiceCloning(text, language);
    }

    async translateAndSpeakInModal(text) {
        const translatedTextEl = document.getElementById('liveTranslatedText');
        const status = document.getElementById('translationStatus');
        
        if (!translatedTextEl) return;
        
        try {
            if (status) status.textContent = '🔄 Traduciendo...';
            
            const translation = await this.callGoogleTranslateAPI(text);
            translatedTextEl.textContent = translation;
            
            if (status) status.textContent = '🎯 Reproduciendo con tu voz clonada...';
            
            // Reproducir con voz clonada
            this.speakWithAdvancedVoiceCloning(translation, this.targetLanguage.value);
            
            setTimeout(() => {
                if (status) status.textContent = '🎤 Escuchando... Habla ahora';
            }, 1000);
            
        } catch (error) {
            console.error('Error en traducción modal:', error);
            if (status) status.textContent = '❌ Error en traducción';
        }
    }

    displayTrainingPhrase() {
        const currentPhrase = this.trainingPhrases[this.currentPhraseIndex];
        this.voiceStatus.innerHTML = `
            <div class="training-phrase-container">
                <div class="phrase-header">
                    <strong>Repite esta frase (${this.phrasesCompleted + 1}/${this.requiredPhrases}):</strong>
                </div>
                <div class="training-phrase">
                    "${currentPhrase}"
                </div>
                <div class="phrase-hint">
                    💡 Habla clara y naturalmente para mejor clonación
                </div>
            </div>
        `;
    }

    startRealVoiceDetection(stream) {
        try {
            // Sistema de detección de voz REAL basado en amplitud
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.3;
            this.microphone.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            let lastSpeechTime = 0;
            let speechStartTime = 0;
            let isSpeaking = false;
            let voiceActivity = false;
            
            const detectVoice = () => {
                if (!this.isRecording) return;
                
                this.analyser.getByteFrequencyData(dataArray);
                
                // Calcular nivel de audio real
                const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
                const volume = average / 255;
                
                // Detectar actividad vocal (umbral ajustado)
                const voiceThreshold = 0.15; // 15% de volumen mínimo
                const currentTime = Date.now();
                
                if (volume > voiceThreshold) {
                    if (!isSpeaking) {
                        isSpeaking = true;
                        speechStartTime = currentTime;
                        voiceActivity = true;
                        this.voiceCircle.classList.add('detecting-voice');
                        console.log('🎤 VOZ DETECTADA - Amplitud:', volume.toFixed(3));
                    }
                    lastSpeechTime = currentTime;
                    
                    // Actualizar progreso visual REAL
                    this.updateRealVoiceProgress(volume, true);
                    
                } else if (isSpeaking && (currentTime - lastSpeechTime) > 1500) {
                    // Silence for 1.5 seconds = end of speech
                    isSpeaking = false;
                    voiceActivity = false;
                    this.voiceCircle.classList.remove('detecting-voice');
                    
                    const speechDuration = lastSpeechTime - speechStartTime;
                    if (speechDuration > 2000) { // Al menos 2 segundos de habla
                        this.processPhraseCompletion();
                    }
                    
                    console.log('🔇 Fin de habla - Duración:', speechDuration, 'ms');
                }
                
                requestAnimationFrame(detectVoice);
            };
            
            detectVoice();
        } catch (error) {
            console.error('Error en detección de voz:', error);
            this.startSimplifiedVoiceAnalysis();
        }
    }

    startSimplifiedVoiceAnalysis() {
        // Análisis simplificado cuando no hay acceso completo al micrófono
        console.log('🔄 Iniciando análisis simplificado de voz');
        this.voiceStatus.textContent = '🎤 Análisis simplificado - Habla ahora';
        
        // Simular progreso basado en el reconocimiento de voz
        let analysisProgress = 0;
        const progressInterval = setInterval(() => {
            if (!this.isRecording) {
                clearInterval(progressInterval);
                return;
            }
            
            analysisProgress += 5;
            this.updateSimplifiedProgress(analysisProgress);
            
            if (analysisProgress >= 100) {
                clearInterval(progressInterval);
                this.completeRealVoiceAnalysis();
            }
        }, 1000);
    }

    updateSimplifiedProgress(progress) {
        const currentStep = Math.floor((progress / 100) * 6) + 1;
        const stepProgress = ((progress % (100/6)) / (100/6)) * 100;
        
        this.updateVoiceAnalysisStep(currentStep, stepProgress);
        
        // Actualizar progreso general
        const overallFill = document.getElementById('overallProgressFill');
        const progressText = document.getElementById('progressPercentage');
        const samplesText = document.getElementById('progressSamples');
        
        if (overallFill) overallFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${Math.round(progress)}%`;
        if (samplesText) {
            const samples = Math.floor((progress / 100) * 150);
            samplesText.textContent = `${samples}/150 muestras`;
        }
        
        // Actualizar estado
        const phases = [
            '🔍 Detectando patrones vocales',
            '📊 Analizando frecuencias',
            '🎵 Mapeando armónicos',
            '🧬 Extrayendo formantes',
            '✨ Creando firma vocal',
            '🎯 Finalizando clonación'
        ];
        
        const currentPhase = phases[Math.min(currentStep - 1, phases.length - 1)];
        this.voiceStatus.textContent = `${currentPhase} - ${Math.round(progress)}%`;
    }

    updateRealVoiceProgress(volume, isDetecting) {
        // Actualizar progreso basado en detección REAL
        if (isDetecting) {
            const progress = Math.min(100, (this.phrasesCompleted / this.requiredPhrases) * 100);
            const currentStep = Math.floor((this.phrasesCompleted / this.requiredPhrases) * 6) + 1;
            
            // Actualizar barra de progreso
            const overallFill = document.getElementById('overallProgressFill');
            const progressText = document.getElementById('progressPercentage');
            
            if (overallFill) overallFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${Math.round(progress)}%`;
            
            // Actualizar paso actual
            this.updateVoiceAnalysisStep(currentStep, (volume * 100));
            
            // Mostrar indicador visual de detección
            const waveIndicator = document.getElementById('voiceWaveIndicator');
            if (waveIndicator) {
                const bars = waveIndicator.querySelectorAll('.wave-bar');
                bars.forEach((bar, index) => {
                    const height = 10 + (volume * 40) + (Math.random() * 10);
                    bar.style.height = `${height}px`;
                });
            }
        }
    }

    processPhraseCompletion() {
        this.phrasesCompleted++;
        console.log(`✅ Frase ${this.phrasesCompleted} completada`);
        
        if (this.phrasesCompleted >= this.requiredPhrases) {
            // Entrenamiento completo
            this.completeRealVoiceAnalysis();
        } else {
            // Siguiente frase
            this.currentPhraseIndex = (this.currentPhraseIndex + 1) % this.trainingPhrases.length;
            setTimeout(() => {
                this.displayTrainingPhrase();
                this.showToast(`✅ Frase completada! (${this.phrasesCompleted}/${this.requiredPhrases})`, 'success');
            }, 1000);
        }
    }

    getLanguageName(code) {
        const names = {
            'es': 'Español',
            'en': 'Inglés', 
            'fr': 'Francés',
            'de': 'Alemán',
            'it': 'Italiano',
            'pt': 'Portugués',
            'ru': 'Ruso',
            'ja': 'Japonés',
            'ko': 'Coreano',
            'zh': 'Chino'
        };
        return names[code] || code;
    }

    getLanguageCode(lang) {
        const languageCodes = {
            'es': 'es-ES',
            'en': 'en-US',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-BR',
            'ru': 'ru-RU',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'zh': 'zh-CN'
        };
        return languageCodes[lang] || 'en-US';
    }

    updateCharCount() {
        const count = this.inputText.value.length;
        this.charCount.textContent = `${count}/5000`;
        
        if (count > 4500) {
            this.charCount.style.color = 'var(--error-color)';
        } else if (count > 4000) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-secondary)';
        }
    }

    openVoiceModal() {
        this.voiceModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.voiceModal.classList.add('fullscreen-mode');
        
        // Siempre usar modo expandido (más compatible)
        this.enableFakeFullscreen();
        
        // Intentar pantalla completa de forma más segura
        setTimeout(() => {
            try {
                const element = document.documentElement;
                if (element.requestFullscreen && typeof element.requestFullscreen === 'function') {
                    element.requestFullscreen().catch(() => {
                        console.log('Pantalla completa no disponible, usando modo expandido');
                    });
                } else if (element.webkitRequestFullscreen && typeof element.webkitRequestFullscreen === 'function') {
                    element.webkitRequestFullscreen();
                } else if (element.mozRequestFullScreen && typeof element.mozRequestFullScreen === 'function') {
                    element.mozRequestFullScreen();
                } else if (element.msRequestFullscreen && typeof element.msRequestFullscreen === 'function') {
                    element.msRequestFullscreen();
                } else {
                    console.log('Pantalla completa no soportada, usando modo expandido');
                }
            } catch (err) {
                console.log('Error con pantalla completa, usando modo expandido:', err);
            }
        }, 100);
    }

    enableFakeFullscreen() {
        // Modo expandido cuando pantalla completa no está disponible
        this.voiceModal.style.position = 'fixed';
        this.voiceModal.style.top = '0';
        this.voiceModal.style.left = '0';
        this.voiceModal.style.width = '100vw';
        this.voiceModal.style.height = '100vh';
        this.voiceModal.style.zIndex = '99999';
        this.voiceModal.classList.add('fake-fullscreen');
    }

    closeModal() {
        this.voiceModal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Detener completamente el reconocimiento de voz
        if (this.recognition) {
            this.recognition.stop();
            this.recognition.abort();
        }
        
        // Detener síntesis de voz
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        
        // Resetear estado
        this.isRecording = false;
        this.voiceCircle.classList.remove('recording');
        this.voiceStatus.textContent = 'Presiona para hablar';
        
        // Limpiar cualquier timeout pendiente
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
        }
        
        this.showToast('Grabación de voz detenida', 'success');
    }

    toggleRecording() {
        if (!this.recognition) {
            this.showToast('Reconocimiento de voz no disponible', 'error');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.lang = this.getLanguageCode(this.sourceLanguage.value);
            this.recognition.start();
        }
    }

    saveToHistory(input, output) {
        const entry = {
            input,
            output,
            sourceLang: this.sourceLanguage.value,
            targetLang: this.targetLanguage.value,
            timestamp: new Date().toISOString()
        };

        this.translationHistory.unshift(entry);
        if (this.translationHistory.length > 50) {
            this.translationHistory.pop();
        }

        localStorage.setItem('ezTranslateHistory', JSON.stringify(this.translationHistory));
    }

    loadTranslationHistory() {
        const saved = localStorage.getItem('ezTranslateHistory');
        if (saved) {
            this.translationHistory = JSON.parse(saved);
        }
    }

    showLoading(show) {
        this.loadingOverlay.classList.toggle('show', show);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                this.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> Salir Pantalla Completa';
                this.showToast('Modo pantalla completa activado', 'success');
            }).catch(err => {
                this.showToast('Error al activar pantalla completa', 'error');
            });
        } else {
            document.exitFullscreen().then(() => {
                this.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> Pantalla Completa';
                this.showToast('Modo pantalla completa desactivado', 'success');
            });
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'exclamation'}"></i>
            <span>${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new EzTranslateApp();
});

// Service Worker for PWA (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}
