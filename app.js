(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────
    let activeQuestions = [];       // The current set of questions (filtered or all)
    let currentQuestionIndex = 0;
    let score = 0;
    let wrongScore = 0;
    let incorrectAnswers = [];
    let selectedCategory = null;    // null = all categories
    let timerInterval = null;
    let timeRemaining = 1200; // 20 minutes in seconds
    let originalTotalQuestions = 0;
    let quizCompletionTime = null;
    let startTime = null;
    const BATCH_SIZE = 5;

    // ── DOM References ─────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const screenStart = $('#screen-start');
    const screenQuiz = $('#screen-quiz');
    const screenResult = $('#screen-result');
    const progressInfo = $('#progress-info');
    const progressText = $('#progress-text');
    const progressFill = $('#progress-bar-fill');
    const questionBatchContainer = $('#question-batch-container');
    const questionBlockTemplate = $('#question-block-template');
    const optionTemplate = $('#option-template');
    const btnCheck = $('#btn-check');
    const btnStart = $('#btn-start');
    const btnRestart = $('#btn-restart');
    const btnBackHome = $('#btn-back-home');
    const btnRetryIncorrect = $('#btn-retry-incorrect');
    const btnExportPdf = $('#btn-export-pdf');
    const categoryChips = $('#category-chips');
    const statQuestions = $('#stat-questions');
    const statMulti = $('#stat-multi');
    const inputTime = $('#input-time');
    const inputQuestions = $('#input-questions');
    const inputShowHints = $('#input-show-hints');

    // Live Score & Quiz Top Bar
    const liveCorrect = $('#live-correct');
    const liveWrong = $('#live-wrong');
    const liveUnanswered = $('#live-unanswered');
    const btnQuizBack = $('#btn-quiz-back');

    // Result screen
    const resultIconWrapper = $('#result-icon-wrapper');
    const resultTitle = $('#result-title');
    const resultSubtitle = $('#result-subtitle');
    const scoreCircle = $('#score-circle');
    const scoreNumber = $('#score-number');
    const scoreTotal = $('#score-total');
    const resultMessage = $('#result-message');
    const wrongAnswersSummary = $('#wrong-answers-summary');
    const wrongAnswersList = $('#wrong-answers-list');
    const resultCompletionTime = $('#result-completion-time');
    
    // New Stats Elements
    const resStatCorrect = $('#res-stat-correct');
    const resStatWrong = $('#res-stat-wrong');
    const resStatPercent = $('#res-stat-percent');
    const resStatTime = $('#res-stat-time');
    const categoryBreakdownContainer = $('#category-breakdown-container');
    const categoryBreakdownList = $('#category-breakdown-list');

    // History Elements
    const historySection = $('#history-section');
    const historyList = $('#history-list');
    const btnClearHistory = $('#btn-clear-history');

    // Timer & Modal
    const timerDisplay = $('#timer-display');
    const timerText = $('#timer-text');
    const avgTimeDisplay = $('#avg-time-display');
    const avgTimeText = $('#avg-time-text');
    const modalTimeup = $('#modal-timeup');
    const btnTimeupResult = $('#btn-timeup-result');

    // ── Extract unique categories from data ────────────────
    function getCategories() {
        const cats = new Map();
        QUIZ_DATA.forEach((q) => {
            if (!cats.has(q.category)) {
                cats.set(q.category, 0);
            }
            cats.set(q.category, cats.get(q.category) + 1);
        });
        return cats;
    }

    // ── Build category chips on start screen ───────────────
    function buildCategoryChips() {
        const cats = getCategories();

        // "Alle Fragen" chip
        const allChip = document.createElement('button');
        allChip.className = 'category-chip active';
        allChip.dataset.category = '__all__';
        allChip.textContent = `Alle Fragen (${QUIZ_DATA.length})`;
        allChip.addEventListener('click', () => selectCategory(null, allChip));
        categoryChips.appendChild(allChip);

        // Individual category chips
        cats.forEach((count, cat) => {
            const chip = document.createElement('button');
            chip.className = 'category-chip';
            chip.dataset.category = cat;
            // Extract short name (remove number prefix)
            const shortName = cat.replace(/^\d+\s*/, '');
            chip.textContent = `${shortName} (${count})`;
            chip.addEventListener('click', () => selectCategory(cat, chip));
            categoryChips.appendChild(chip);
        });

        updateStats();
    }

    function selectCategory(category, chipEl) {
        selectedCategory = category;

        // Update active state on chips
        categoryChips.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
        chipEl.classList.add('active');

        updateStats();
    }

    function updateStats() {
        const filtered = getFilteredQuestions();
        const availableCount = filtered.length;
        statQuestions.textContent = availableCount;
        const multiCount = filtered.filter((q) => q.correctAnswers.length > 1).length;
        statMulti.textContent = multiCount;

        if (inputQuestions) {
            inputQuestions.max = availableCount;
            if (parseInt(inputQuestions.value, 10) > availableCount) {
                inputQuestions.value = availableCount;
            } else if (!inputQuestions.value || parseInt(inputQuestions.value, 10) < 1) {
                inputQuestions.value = Math.min(40, availableCount);
            }
        }
    }

    function getFilteredQuestions() {
        if (!selectedCategory) return [...QUIZ_DATA];
        return QUIZ_DATA.filter((q) => q.category === selectedCategory);
    }

    // ── Live Score Update ──────────────────────────────────
    function updateLiveScore() {
        if (!liveCorrect || !liveWrong || !liveUnanswered) return;
        liveCorrect.textContent = score;
        liveWrong.textContent = wrongScore;
        const unanswered = activeQuestions.length - (score + wrongScore);
        liveUnanswered.textContent = Math.max(0, unanswered);
    }

    // ── Shuffle array (Fisher-Yates) ──────────────────────
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ── Utility: Create SVG inline ─────────────────────────
    function checkSVG(color = '#fff', size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }

    function crossSVG(color = '#fff', size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    }

    // ── Timer Logic ────────────────────────────────────────
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ── Average Time per Question ──────────────────────────
    function updateAvgTime() {
        if (!avgTimeDisplay || !avgTimeText) return;

        // Number of questions not yet processed (correctly or incorrectly)
        const questionsLeft = originalTotalQuestions - (score + wrongScore);
        if (timeRemaining <= 0 || questionsLeft <= 0) {
            avgTimeText.textContent = '--:-- / Frage';
            avgTimeDisplay.style.opacity = '0.5';
            return;
        }

        avgTimeDisplay.style.opacity = '1';
        const avgSeconds = Math.floor(timeRemaining / questionsLeft);
        avgTimeText.textContent = `~${formatTime(avgSeconds)} / Frage`;
    }

    function startTimer() {
        clearInterval(timerInterval);
        const minutes = parseInt(inputTime.value, 10) || 20;
        timeRemaining = minutes * 60;
        timerText.textContent = formatTime(timeRemaining);
        timerDisplay.style.color = 'var(--text-primary)';

        timerInterval = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                stopTimer();
                handleTimeUp(); // Then shows modal
            }
            timerText.textContent = formatTime(timeRemaining);
            updateAvgTime();

            // Subtle visual warning in last 60 seconds
            if (timeRemaining <= 60 && timeRemaining > 0) {
                timerDisplay.style.color = '#ef4444'; // var(--wrong)
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function handleTimeUp() {
        // Evaluate the current batch if any answers are selected, then show modal
        if (questionBatchContainer.querySelector('.option-item.selected')) {
            evaluateCurrentBatch();
        }
        modalTimeup.classList.remove('hidden');
    }

    // ── Screen Navigation ──────────────────────────────────
    function showScreen(screen) {
        [screenStart, screenQuiz, screenResult].forEach((s) => {
            s.classList.remove('active');
        });
        // Force reflow for animation
        void screen.offsetWidth;
        screen.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Render Question Batch ──────────────────────────────
    function renderQuestionBatch() {
        questionBatchContainer.innerHTML = ''; // Clear previous batch

        const batchEndIndex = Math.min(currentQuestionIndex + BATCH_SIZE, activeQuestions.length);

        // Update progress
        const startNum = currentQuestionIndex + 1;
        const endNum = batchEndIndex;
        progressText.textContent = `Fragen ${startNum}-${endNum} / ${originalTotalQuestions}`;
        progressFill.style.width = `${(currentQuestionIndex / originalTotalQuestions) * 100}%`;
        updateAvgTime();

        for (let i = currentQuestionIndex; i < batchEndIndex; i++) {
            const q = activeQuestions[i];
            const questionIndexInQuiz = i;

            const block = questionBlockTemplate.content.cloneNode(true).firstElementChild;
            block.dataset.questionId = q.id;

            // Populate block
            block.querySelector('.question-badge').textContent = `Frage ${questionIndexInQuiz + 1}`;
            const shortCat = q.category.replace(/^\d+\s*/, '');
            block.querySelector('.question-category-badge').textContent = shortCat;
            const multipleCorrect = q.correctAnswers.length > 1;
            
            const showHints = inputShowHints && inputShowHints.checked;
            if (showHints) {
                block.querySelector('.question-hint').textContent = multipleCorrect
                    ? `${q.correctAnswers.length} richtige Antworten`
                    : '1 richtige Antwort';
            } else {
                block.querySelector('.question-hint').textContent = 'Wähle die passenden Antworten';
            }
            
            block.querySelector('.question-text').textContent = q.question;

            const blockOptionsList = block.querySelector('.options-list');

            // Shuffle options
            const optionsWithOriginalIndex = q.options.map((opt, index) => ({
                ...opt,
                originalIndex: index
            }));
            const shuffledOptions = shuffle(optionsWithOriginalIndex);

            shuffledOptions.forEach((opt) => {
                const item = optionTemplate.content.cloneNode(true).firstElementChild;
                item.dataset.index = opt.originalIndex; // Use original index for evaluation
                item.id = `option-${q.id}-${opt.originalIndex}`;
                item.querySelector('.option-label').textContent = opt.label;
                item.querySelector('.option-text').textContent = opt.text;

                item.addEventListener('click', () => toggleOption(item));
                item.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleOption(item);
                    }
                });

                blockOptionsList.appendChild(item);
            });

            questionBatchContainer.appendChild(block);
        }

        // Reset button
        btnCheck.disabled = true; // Disabled until an option is selected
        const isLastBatch = batchEndIndex >= activeQuestions.length;
        btnCheck.textContent = isLastBatch ? 'Ergebnis anzeigen' : 'Nächste Fragen';

        showScreen(screenQuiz);
    }

    // ── Toggle Option (Checkbox Behavior) ──────────────────
    function toggleOption(item) {
        const isSelected = item.classList.toggle('selected');
        item.setAttribute('aria-checked', isSelected ? 'true' : 'false');

        // Enable check button if at least one option is selected anywhere in the batch
        const anySelected = questionBatchContainer.querySelector('.option-item.selected');
        btnCheck.disabled = !anySelected;
    }

    // ── Evaluate Current Batch ─────────────────────────────
    function evaluateCurrentBatch() {
        const batchEndIndex = Math.min(currentQuestionIndex + BATCH_SIZE, activeQuestions.length);

        for (let i = currentQuestionIndex; i < batchEndIndex; i++) {
            const q = activeQuestions[i];
            const questionBlock = questionBatchContainer.querySelector(`.question-block[data-question-id="${q.id}"]`);
            if (!questionBlock) continue;

            const selectedItems = questionBlock.querySelectorAll('.option-item.selected');
            const selectedIndices = Array.from(selectedItems).map(item => parseInt(item.dataset.index, 10));

            // Only process if an answer was given for this question
            if (selectedIndices.length > 0) {
                const selectedSet = new Set(selectedIndices);
                const correctSet = new Set(q.correctAnswers);
                const isFullyCorrect =
                    selectedSet.size === correctSet.size &&
                    [...correctSet].every((i) => selectedSet.has(i));

                if (isFullyCorrect) {
                    score++;
                } else {
                    wrongScore++;
                    incorrectAnswers.push({
                        question: q,
                        selected: selectedIndices,
                        timestamp: new Date()
                    });
                }
            }
        }
        updateLiveScore();
    }

    // ── Show Results ───────────────────────────────────────
    function showResults() {
        stopTimer();
        quizCompletionTime = new Date();
        
        // Calculate duration
        let durationStr = "00:00";
        if (startTime) {
            const durationSec = Math.floor((new Date() - startTime) / 1000);
            durationStr = formatTime(durationSec);
        }
        
        const totalQuestions = originalTotalQuestions;

        if (btnExportPdf) btnExportPdf.classList.remove('hidden');

        // Hide avg time display on result screen
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'none';
        }

        // Update progress bar to 100%
        progressFill.style.width = '100%';
        progressText.textContent = `Ergebnis von ${totalQuestions} Fragen`;

        const percent = Math.round((score / totalQuestions) * 100);

        // ── Populate New Stats Grid ──
        if (resStatCorrect) resStatCorrect.textContent = score;
        if (resStatWrong) resStatWrong.textContent = wrongScore;
        if (resStatPercent) resStatPercent.textContent = `${percent}%`;
        if (resStatTime) resStatTime.textContent = durationStr;

        // ── Generate Category Breakdown ──
        if (categoryBreakdownContainer && categoryBreakdownList) {
            categoryBreakdownContainer.classList.remove('hidden');
            categoryBreakdownList.innerHTML = '';
            
            // Calculate stats per category
            const catStats = {};
            activeQuestions.forEach(q => {
                const catName = q.category.replace(/^\d+\s*/, ''); // Clean name
                if (!catStats[catName]) {
                    catStats[catName] = { total: 0, correct: 0 };
                }
                catStats[catName].total++;
                catStats[catName].correct++; // Assume correct initially
            });

            // Adjust for wrong answers
            incorrectAnswers.forEach(item => {
                const catName = item.question.category.replace(/^\d+\s*/, '');
                if (catStats[catName]) {
                    catStats[catName].correct--;
                }
            });

            // Render bars
            Object.keys(catStats).forEach(cat => {
                const data = catStats[cat];
                if (data.total === 0) return;
                const p = Math.round((data.correct / data.total) * 100);
                
                let colorClass = 'low';
                if (p >= 80) colorClass = 'high';
                else if (p >= 50) colorClass = 'med';

                const item = document.createElement('div');
                item.className = 'cat-stat-item';
                item.innerHTML = `
                    <div class="cat-stat-header">
                        <span>${cat}</span>
                        <span>${data.correct}/${data.total} (${p}%)</span>
                    </div>
                    <div class="cat-progress-track">
                        <div class="cat-progress-fill ${colorClass}" style="width: ${p}%"></div>
                    </div>
                `;
                categoryBreakdownList.appendChild(item);
            });
        }

        // Save result to history
        saveHistoryResult(score, totalQuestions, selectedCategory);

        // Display completion time
        if (resultCompletionTime) {
            const datePart = quizCompletionTime.toLocaleDateString('de-DE');
            const timePart = quizCompletionTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            resultCompletionTime.textContent = `Abgeschlossen am ${datePart} um ${timePart} Uhr`;
        }

        // Icon & theme
        let iconHTML, titleText, subtitleText, messageText, iconClass;

        if (percent === 100) {
            iconClass = 'perfect';
            iconHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
            titleText = 'Perfekt! 🎉';
            subtitleText = 'Alle Fragen komplett richtig beantwortet!';
            messageText = 'Hervorragende Leistung! Du hast jede Frage fehlerfrei beantwortet. Dein KI-Wissen ist top!';
        } else if (percent >= 80) {
            iconClass = 'perfect';
            iconHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
            titleText = 'Sehr gut! 🌟';
            subtitleText = `Du hast ${score} von ${totalQuestions} Fragen komplett richtig (${percent}%).`;
            messageText = 'Ausgezeichnet! Du hast ein starkes Fundament. Die wenigen Fehler sind leicht aufholbar.';
        } else if (percent >= 50) {
            iconClass = 'good';
            iconHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            titleText = 'Gut gemacht! 👍';
            subtitleText = `Du hast ${score} von ${totalQuestions} Fragen komplett richtig (${percent}%).`;
            messageText = 'Solide Leistung! Es gibt noch Raum für Verbesserung – probiere es erneut, um alles zu knacken.';
        } else {
            iconClass = 'needs-work';
            iconHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
            titleText = 'Weiter üben! 💪';
            subtitleText = `Du hast ${score} von ${totalQuestions} Fragen komplett richtig (${percent}%).`;
            messageText = 'Nicht aufgeben! Schau dir die Themen nochmal an und starte einen neuen Versuch.';
        }

        resultIconWrapper.className = `result-icon-wrapper ${iconClass}`;
        resultIconWrapper.innerHTML = iconHTML;
        resultTitle.textContent = titleText;
        resultSubtitle.textContent = subtitleText;
        resultMessage.textContent = messageText;

        // Render summary of wrong answers
        if (incorrectAnswers.length > 0) {
            wrongAnswersSummary.classList.remove('hidden');
            btnRetryIncorrect.classList.remove('hidden');
            wrongAnswersList.innerHTML = ''; // Clear previous results

            incorrectAnswers.forEach(item => {
                const { question, selected, timestamp } = item;
                const summaryItem = document.createElement('div');
                summaryItem.className = 'wrong-answer-item';

                const selectedSet = new Set(selected);
                const correctSet = new Set(question.correctAnswers);

                // Build a concise summary of what the correct answer(s) would have been
                const correctTexts = question.correctAnswers
                    .map(i => `${question.options[i].label}) ${question.options[i].text}`)
                    .join(', ');
                const answerLabel = question.correctAnswers.length > 1 ? 'Richtige Antworten' : 'Richtige Antwort';
                const correctSummaryLine = `<p class="wrong-q-correct-summary"><strong>${answerLabel} wäre${question.correctAnswers.length > 1 ? 'n' : ''}: ${correctTexts}</strong></p>`;

                let optionsHtml = '<div class="wrong-q-options-list">';
                question.options.forEach((opt, index) => {
                    const isSelected = selectedSet.has(index);
                    const isCorrect = correctSet.has(index);
                    
                    let itemClass = 'wrong-q-option';
                    let indicator = '';

                    if (isSelected && !isCorrect) {
                        itemClass += ' wrong';
                        indicator = '✗ Deine Wahl';
                    } else if (isCorrect) {
                        if (isSelected) {
                            itemClass += ' correct';
                            indicator = '✓ Deine Wahl';
                        } else {
                            itemClass += ' missed';
                            indicator = 'Wäre richtig gewesen';
                        }
                    } else { // not selected, not correct
                        itemClass += ' neutral';
                    }

                    optionsHtml += `
                        <div class="${itemClass}">
                            <span class="option-line-content">
                                <span class="option-line-label">${opt.label})</span>
                                <span class="option-line-text">${opt.text}</span>
                            </span>
                            ${indicator ? `<span class="option-line-indicator">${indicator}</span>` : ''}
                        </div>
                    `;
                });
                optionsHtml += '</div>';

                // Rationale (Erklärung) hinzufügen, falls vorhanden
                let rationaleHtml = '';
                if (question.rationale) {
                    rationaleHtml = `<div class="wrong-q-rationale"><strong>Erklärung:</strong> ${question.rationale}</div>`;
                }

                const formattedTime = timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

                summaryItem.innerHTML = `
                    <div class="wrong-q-header">
                        <p class="wrong-q-text">${question.question}</p>
                        <span class="wrong-q-timestamp">${formattedTime} Uhr</span>
                    </div>
                    ${correctSummaryLine}
                    ${optionsHtml}
                    ${rationaleHtml}
                `;
                wrongAnswersList.appendChild(summaryItem);
            });

                // Rationale (Erklärung) hinzufügen, falls vorhanden
                let rationaleHtml = '';
                if (question.rationale) {
                    rationaleHtml = `<div class="wrong-q-rationale"><strong>Erklärung:</strong> ${question.rationale}</div>`;
                }

                const formattedTime = timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

                summaryItem.innerHTML = `
                    <div class="wrong-q-header">
                        <p class="wrong-q-text">${question.question}</p>
                        <span class="wrong-q-timestamp">${formattedTime} Uhr</span>
                    </div>
                    ${optionsHtml}
                    ${rationaleHtml}
                `;
                wrongAnswersList.appendChild(summaryItem);
            });
        } else {
            wrongAnswersSummary.classList.add('hidden');
            btnRetryIncorrect.classList.add('hidden');
        }

        // Score ring
        scoreTotal.textContent = `/ ${totalQuestions}`;

        // Add gradient definition to score SVG if not present
        const scoreSvg = document.querySelector('.score-svg');
        if (!scoreSvg.querySelector('#scoreGradient')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#6366f1"/>
          <stop offset="100%" style="stop-color:#22c55e"/>
        </linearGradient>
      `;
            scoreSvg.prepend(defs);
        }

        // Animate score ring
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (score / totalQuestions) * circumference;

        // Reset first
        scoreCircle.style.transition = 'none';
        scoreCircle.style.strokeDashoffset = circumference;
        scoreNumber.textContent = '0';

        showScreen(screenResult);

        // Animate after a small delay
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scoreCircle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
                scoreCircle.style.strokeDashoffset = offset;
                animateNumber(scoreNumber, 0, score, 900);
            });
        });
    }

    // ── Animate Number ─────────────────────────────────────
    function animateNumber(element, from, to, duration) {
        const start = performance.now();
        function step(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.round(from + (to - from) * eased);
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    // ── Start Quiz ─────────────────────────────────────────
    function startQuiz() {
        const filtered = getFilteredQuestions();
        const questionLimit = parseInt(inputQuestions.value, 10) || 40;
        activeQuestions = shuffle(filtered).slice(0, questionLimit);
        originalTotalQuestions = activeQuestions.length;
        currentQuestionIndex = 0;
        score = 0;
        wrongScore = 0;
        incorrectAnswers = [];
        progressFill.style.width = '0%';
        progressInfo.classList.add('visible');
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        startTime = new Date();
        renderQuestionBatch();
    }

    // ── Reset Quiz (same category) ─────────────────────────
    function restartQuiz() {
        const filtered = getFilteredQuestions();
        const questionLimit = parseInt(inputQuestions.value, 10) || 40;
        activeQuestions = shuffle(filtered).slice(0, questionLimit);
        originalTotalQuestions = activeQuestions.length;
        currentQuestionIndex = 0;
        score = 0;
        wrongScore = 0;
        incorrectAnswers = [];
        progressFill.style.width = '0%';
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        startTime = new Date();
        renderQuestionBatch();
    }

    // ── Retry Incorrect Questions ──────────────────────────
    function retryIncorrect() {
        if (incorrectAnswers.length === 0) return;

        // Set active questions to only the ones that were incorrect
        activeQuestions = shuffle(incorrectAnswers.map(item => item.question));
        originalTotalQuestions = activeQuestions.length;

        // Reset quiz state for the new round
        currentQuestionIndex = 0;
        score = 0;
        wrongScore = 0;
        incorrectAnswers = [];

        // Reset UI elements and start the quiz
        progressFill.style.width = '0%';
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        startTime = new Date();
        renderQuestionBatch();
    }

    // ── Export Results to PDF ──────────────────────────────
    function exportResultsToPdf() {
        // Check if jsPDF is loaded
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error("jsPDF library is not loaded.");
            alert("Die PDF-Export-Bibliothek konnte nicht geladen werden. Bitte überprüfe deine Internetverbindung.");
            return;
        }

        // Initialize PDF
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        // Constants
        const margin = 15;
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
        const lineHeight = 5; // approx line height in mm for 10pt font
        let y = margin;

        // Helper for page breaks
        const checkPageBreak = (neededHeight) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        };

        // --- 1. PDF Header ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Ergebnis deines KI-Quiz", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 15;

        // --- 2. Score Summary ---
        const percent = originalTotalQuestions > 0 ? Math.round((score / originalTotalQuestions) * 100) : 0;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text(`Erreichte Punktzahl: ${score} von ${originalTotalQuestions} (${percent}%)`, margin, y);
        y += 6;
        if (quizCompletionTime) {
            const datePart = quizCompletionTime.toLocaleDateString('de-DE');
            const timePart = quizCompletionTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Abgeschlossen am ${datePart} um ${timePart} Uhr`, margin, y);
        }
        y += 15;

        // --- 3. Detaillierte Statistiken ---
        checkPageBreak(35);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Statistik im Überblick", margin, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);

        const col1_x = margin;
        const col2_x = margin + (contentWidth / 2);
        let durationStr = "00:00";
        if (startTime) {
            const durationSec = Math.floor((new Date() - startTime) / 1000);
            durationStr = formatTime(durationSec);
        }

        doc.text(`✅ Richtig: ${score}`, col1_x, y);
        doc.text(`❌ Falsch: ${wrongScore}`, col2_x, y);
        y += 7;

        doc.text(`🎯 Quote: ${percent}%`, col1_x, y);
        doc.text(`⏱️ Zeit: ${durationStr}`, col2_x, y);
        y += 15;

        // --- 4. Analyse nach Themengebieten ---
        checkPageBreak(15);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Analyse nach Themengebieten", margin, y);
        y += 8;

        // Calculate stats per category (re-calculation for self-contained export)
        const catStats = {};
        activeQuestions.forEach(q => {
            const catName = q.category.replace(/^\d+\s*/, ''); // Clean name
            if (!catStats[catName]) {
                catStats[catName] = { total: 0, correct: 0 };
            }
            catStats[catName].total++;
            catStats[catName].correct++; // Assume correct initially
        });
        incorrectAnswers.forEach(item => {
            const catName = item.question.category.replace(/^\d+\s*/, '');
            if (catStats[catName]) {
                catStats[catName].correct--;
            }
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const sortedCategories = Object.keys(catStats).sort();
        sortedCategories.forEach(cat => {
            const data = catStats[cat];
            if (data.total === 0) return;
            const p = Math.round((data.correct / data.total) * 100);
            const statLine = `${cat}: ${data.correct} von ${data.total} (${p}%)`;
            checkPageBreak(lineHeight + 2);
            doc.text(statLine, margin, y);
            y += lineHeight + 1;
        });
        y += 10;

        // --- 5. Incorrect Answers Section ---
        if (incorrectAnswers.length > 0) {
            checkPageBreak(10);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("Zusammenfassung der Fehler", margin, y);
            y += 10;

            incorrectAnswers.forEach((item, index) => {
                const { question, selected, timestamp } = item;
                const selectedSet = new Set(selected);
                const correctSet = new Set(question.correctAnswers);

                // --- Prepare text blocks ---
                const formattedTime = timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                const questionTextLines = doc.splitTextToSize(`${index + 1}. ${question.question}`, contentWidth);
                
                // build a summary line for correct answer(s)
                const correctTexts = question.correctAnswers
                    .map(i => `${question.options[i].label}) ${question.options[i].text}`)
                    .join(', ');
                const answerLabel = question.correctAnswers.length > 1 ? 'Richtige Antworten' : 'Richtige Antwort';
                const corrSummaryLines = doc.splitTextToSize(`${answerLabel}: ${correctTexts}`, contentWidth);

                const allOptionsText = [];
                question.options.forEach((opt, optIndex) => {
                    const isSelected = selectedSet.has(optIndex);
                    const isCorrect = correctSet.has(optIndex);
                    let indicator = '';
                    if (isSelected && !isCorrect) indicator = '(✗ Deine Wahl)';
                    else if (isSelected && isCorrect) indicator = '(✓ Deine Wahl)';
                    else if (!isSelected && isCorrect) indicator = '(Wäre richtig gewesen)';
                    allOptionsText.push(`${opt.label}) ${opt.text} ${indicator}`);
                });
                const allOptionsLines = doc.splitTextToSize(allOptionsText.join('\n'), contentWidth);
                const neededHeight = (questionTextLines.length + allOptionsLines.length) * lineHeight + 15;
                checkPageBreak(neededHeight);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text(questionTextLines, margin, y);
                y += questionTextLines.length * lineHeight + 1;

                // print correct answer summary
                if (corrSummaryLines && corrSummaryLines.length) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(40, 40, 40);
                    doc.text(corrSummaryLines, margin, y);
                    y += corrSummaryLines.length * lineHeight + 2;
                }

                // Add timestamp
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 120); // Muted gray
                doc.text(`Beantwortet um ${formattedTime} Uhr`, margin, y);
                y += lineHeight + 2;

                // Render all options
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(40, 40, 40);
                doc.text(allOptionsLines, margin, y);
                y += allOptionsLines.length * lineHeight + 4;

                // Add rationale to PDF
                if (question.rationale) {
                    const rationaleLines = doc.splitTextToSize(`Erklärung: ${question.rationale}`, contentWidth);
                    checkPageBreak(rationaleLines.length * lineHeight + 5);
                    
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(80, 80, 80); // Dunkelgrau für Erklärung
                    doc.text(rationaleLines, margin, y);
                    y += rationaleLines.length * lineHeight + 8;
                } else {
                    y += 5;
                }
            });
        } else {
            checkPageBreak(10);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(34, 197, 94);
            doc.text("Perfekt! Du hast alle Fragen richtig beantwortet.", margin, y);
        }

        // --- 6. Save the PDF ---
        doc.setTextColor(0, 0, 0);
        doc.save('KI-Quiz-Ergebnisse.pdf');
    }

    // ── History Functions ──────────────────────────────────
    function saveHistoryResult(score, total, category) {
        const history = JSON.parse(localStorage.getItem('quiz-history') || '[]');
        const newEntry = {
            date: new Date().toISOString(),
            score: score,
            total: total,
            category: category // null means "All"
        };
        
        // Add to beginning
        history.unshift(newEntry);
        
        // Keep only last 5 entries
        if (history.length > 5) {
            history.pop();
        }
        
        localStorage.setItem('quiz-history', JSON.stringify(history));
    }

    function renderHistory() {
        if (!historySection || !historyList) return;
        
        const history = JSON.parse(localStorage.getItem('quiz-history') || '[]');
        
        if (history.length === 0) {
            historySection.classList.add('hidden');
            return;
        }
        
        historySection.classList.remove('hidden');
        historyList.innerHTML = '';
        
        history.forEach(item => {
            const dateObj = new Date(item.date);
            const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            const percent = Math.round((item.score / item.total) * 100);
            
            let badgeClass = 'low';
            if (percent >= 80) badgeClass = 'high';
            else if (percent >= 50) badgeClass = 'med';
            
            const catName = item.category ? item.category.replace(/^\d+\s*/, '') : 'Alle Fragen';

            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-info">
                    <span class="history-cat">${catName}</span>
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-score">
                    <span class="history-val">${item.score}/${item.total}</span>
                    <span class="history-badge ${badgeClass}">${percent}%</span>
                </div>
            `;
            historyList.appendChild(el);
        });
    }

    // ── Go back to home ────────────────────────────────────
    function goHome() {
        stopTimer();
        progressInfo.classList.remove('visible');
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'none';
        }
        if (wrongAnswersSummary) {
            wrongAnswersSummary.classList.add('hidden');
        }
        if (btnRetryIncorrect) {
            btnRetryIncorrect.classList.add('hidden');
        }
        if (btnExportPdf) {
            btnExportPdf.classList.add('hidden');
        }
        if (resultCompletionTime) {
            resultCompletionTime.textContent = '';
        }
        renderHistory(); // Refresh history display
        showScreen(screenStart);
    }

    // ── Button Click Handlers ──────────────────────────────
    btnCheck.addEventListener('click', () => {
        evaluateCurrentBatch();
        currentQuestionIndex += BATCH_SIZE;

        if (currentQuestionIndex < activeQuestions.length) {
            renderQuestionBatch();
        } else {
            showResults();
        }
    });

    btnStart.addEventListener('click', () => startQuiz());
    btnRestart.addEventListener('click', () => restartQuiz());
    btnRetryIncorrect.addEventListener('click', () => retryIncorrect());
    btnExportPdf.addEventListener('click', () => exportResultsToPdf());
    btnBackHome.addEventListener('click', () => goHome());

    btnQuizBack.addEventListener('click', () => {
        if (confirm('Möchtest du das Quiz wirklich abbrechen? Dein aktueller Fortschritt geht dabei verloren.')) {
            goHome();
        }
    });

    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
            if(confirm('Möchtest du den Verlauf wirklich löschen?')) {
                localStorage.removeItem('quiz-history');
                renderHistory();
            }
        });
    }

    btnTimeupResult.addEventListener('click', () => {
        modalTimeup.classList.add('hidden');
        showResults();
    });

    // ── Initialize ─────────────────────────────────────────
    buildCategoryChips();
    renderHistory();
})();
