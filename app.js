/**
 * KI-Quiz – Application Logic
 * 
 * CORE RULE: Evaluation ONLY fires on explicit "Antwort überprüfen" click.
 * The user can freely check/uncheck any number of checkboxes before that.
 */
(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────
    let activeQuestions = [];       // The current set of questions (filtered or all)
    let currentQuestionIndex = 0;
    let score = 0;
    let wrongScore = 0;
    let incorrectAnswers = [];
    let skippedQuestions = [];
    let isEvaluated = false;
    let selectedCategory = null;    // null = all categories
    let timerInterval = null;
    let timeRemaining = 1200; // 20 minutes in seconds
    let questionTimerInterval = null;
    let questionTimeRemaining = 0;
    let originalTotalQuestions = 0;
    let quizCompletionTime = null;

    // ── DOM References ─────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const screenStart = $('#screen-start');
    const screenQuiz = $('#screen-quiz');
    const screenResult = $('#screen-result');
    const progressInfo = $('#progress-info');
    const progressText = $('#progress-text');
    const progressFill = $('#progress-bar-fill');
    const questionBadge = $('#question-badge');
    const questionHint = $('#question-hint');
    const questionText = $('#question-text');
    const questionCategoryBadge = $('#question-category-badge');
    const optionsList = $('#options-list');
    const optionTemplate = $('#option-template');
    const rationaleBox = $('#rationale-box');
    const rationaleText = $('#rationale-text');
    const btnCheck = $('#btn-check');
    const btnStart = $('#btn-start');
    const btnRestart = $('#btn-restart');
    const btnBackHome = $('#btn-back-home');
    const btnRetryIncorrect = $('#btn-retry-incorrect');
    const btnSkip = $('#btn-skip');
    const btnExportPdf = $('#btn-export-pdf');
    const categoryChips = $('#category-chips');
    const statQuestions = $('#stat-questions');
    const statMulti = $('#stat-multi');
    const inputTime = $('#input-time');
    const inputQuestions = $('#input-questions');

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

    // Timer & Modal
    const timerDisplay = $('#timer-display');
    const timerText = $('#timer-text');
    const avgTimeDisplay = $('#avg-time-display');
    const avgTimeText = $('#avg-time-text');
    const modalTimeup = $('#modal-timeup');
    const btnTimeupResult = $('#btn-timeup-result');
    const questionTimerDisplay = $('#question-timer-display');
    const questionTimerText = $('#question-timer-text');

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

        // The number of questions for which time is still running.
        // If the current question is not answered, it's part of the remaining questions.
        // If it is answered, it's not.
        const questionsLeft = isEvaluated
            ? activeQuestions.length - (currentQuestionIndex + 1)
            : activeQuestions.length - currentQuestionIndex;

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
                stopTimer(); // Stops both main and question timer
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

    // ── Question Timer Logic ───────────────────────────────
    function stopQuestionTimer() {
        clearInterval(questionTimerInterval);
        if (questionTimerDisplay) questionTimerDisplay.classList.add('hidden');
    }

    function startQuestionTimer() {
        stopQuestionTimer();
        if (!questionTimerDisplay) return;

        // Calculate the average time available for the remaining questions.
        const questionsLeft = activeQuestions.length - currentQuestionIndex;
        if (timeRemaining <= 0 || questionsLeft <= 0) {
            stopQuestionTimer(); // No time or no questions left, hide the timer.
            return;
        }

        questionTimerDisplay.classList.remove('hidden');
        questionTimeRemaining = Math.floor(timeRemaining / questionsLeft);

        // Update display immediately
        questionTimerDisplay.classList.remove('warning');
        questionTimerText.textContent = formatTime(questionTimeRemaining);

        questionTimerInterval = setInterval(() => {
            questionTimeRemaining--;

            if (questionTimeRemaining <= 5 && questionTimeRemaining >= 0) {
                questionTimerDisplay.classList.add('warning');
            }

            if (questionTimeRemaining < 0) {
                // Time for this question is up. Automatically skip.
                // The skipQuestion function will trigger a re-render, which will stop this timer.
                skipQuestion();
                return; // Stop this execution path.
            }

            questionTimerText.textContent = formatTime(questionTimeRemaining);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        stopQuestionTimer();
    }

    function handleTimeUp() {
        // Evaluate current question if not yet evaluated
        if (!isEvaluated && optionsList.querySelectorAll('.option-item.selected').length > 0) {
            evaluateAnswer();
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
    }

    // ── Render Question ────────────────────────────────────
    function renderQuestion() {
        isEvaluated = false;
        const q = activeQuestions[currentQuestionIndex];

        // Update progress
        const processedCount = score + wrongScore;
        progressText.textContent = `Frage ${processedCount + 1} / ${originalTotalQuestions}`;
        progressFill.style.width = `${(processedCount / originalTotalQuestions) * 100}%`;

        // Update average time display
        updateAvgTime();

        // Badge
        questionBadge.textContent = `Frage ${currentQuestionIndex + 1}`;

        // Category badge
        const shortCat = q.category.replace(/^\d+\s*/, '');
        questionCategoryBadge.textContent = shortCat;

        // Hint for multi-select
        const multipleCorrect = q.correctAnswers.length > 1;
        questionHint.textContent = multipleCorrect
            ? `${q.correctAnswers.length} richtige Antworten`
            : '1 richtige Antwort';

        // Question text
        questionText.textContent = q.question;

        // Build options
        optionsList.innerHTML = '';
        q.options.forEach((opt, index) => {
            const item = optionTemplate.content.cloneNode(true).firstElementChild;
            item.dataset.index = index;
            item.id = `option-${currentQuestionIndex}-${index}`;

            item.querySelector('.option-label').textContent = opt.label;
            item.querySelector('.option-text').textContent = opt.text;

            // Click handler – toggle selection (NO evaluation!)
            item.addEventListener('click', () => toggleOption(item));
            item.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleOption(item);
                }
            });
            
            optionsList.appendChild(item);
        });

        // Hide rationale
        rationaleBox.classList.add('hidden');

        // Show skip button
        btnSkip.classList.remove('hidden');

        // Reset button
        btnCheck.disabled = true;
        btnCheck.classList.remove('btn-next');
        btnCheck.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Antwort überprüfen
    `;

        startQuestionTimer();
        showScreen(screenQuiz);
    }

    // ── Toggle Option (Checkbox Behavior) ──────────────────
    function toggleOption(item) {
        // Block toggling after evaluation
        if (isEvaluated) return;

        const isSelected = item.classList.toggle('selected');
        item.setAttribute('aria-checked', isSelected ? 'true' : 'false');

        // Enable/disable check button based on selection count
        const selectedCount = optionsList.querySelectorAll('.option-item.selected').length;
        btnCheck.disabled = selectedCount === 0;
    }

    // ── Build Rationale HTML ──────────────────────────────
    function buildRationale(q, selectedIndices) {
        const selectedSet = new Set(selectedIndices);
        const correctSet = new Set(q.correctAnswers);
        const isFullyCorrect =
            selectedSet.size === correctSet.size &&
            [...correctSet].every((i) => selectedSet.has(i));

        // Determine title
        const rationaleTitle = $('#rationale-title');
        if (isFullyCorrect) {
            rationaleTitle.textContent = '✓ Richtig!';
        } else {
            // Check if partially correct
            const hasAnyCorrect = selectedIndices.some((i) => correctSet.has(i));
            const hasAnyWrong = selectedIndices.some((i) => !correctSet.has(i));
            const missedSome = q.correctAnswers.some((i) => !selectedSet.has(i));

            if (hasAnyCorrect && (hasAnyWrong || missedSome)) {
                rationaleTitle.textContent = '✗ Teilweise richtig';
            } else {
                rationaleTitle.textContent = '✗ Leider falsch';
            }
        }

        // Build option-by-option feedback
        let html = '<div class="rationale-items">';

        q.options.forEach((opt, index) => {
            const isSelected = selectedSet.has(index);
            const isCorrect = correctSet.has(index);

            if (isSelected && isCorrect) {
                html += `<div class="rationale-item rationale-correct">
                    <span class="rationale-marker correct-marker">✓</span>
                    <span><strong>${opt.label})</strong> ${opt.text} — <em>Richtig gewählt!</em></span>
                </div>`;
            } else if (isSelected && !isCorrect) {
                html += `<div class="rationale-item rationale-wrong">
                    <span class="rationale-marker wrong-marker">✗</span>
                    <span><strong>${opt.label})</strong> ${opt.text} — <em>Diese Antwort ist nicht korrekt.</em></span>
                </div>`;
            } else if (!isSelected && isCorrect) {
                html += `<div class="rationale-item rationale-missed">
                    <span class="rationale-marker missed-marker">!</span>
                    <span><strong>${opt.label})</strong> ${opt.text} — <em>Diese Antwort wäre ebenfalls richtig gewesen.</em></span>
                </div>`;
            }
        });

        html += '</div>';

        // Summary line with correct answers
        if (!isFullyCorrect) {
            const correctLabels = q.correctAnswers.map((i) => q.options[i].label).join(', ');
            html += `<div class="rationale-summary">Korrekte Antwort${q.correctAnswers.length > 1 ? 'en' : ''}: <strong>${correctLabels}</strong></div>`;
        }

        // Show detailed explanation if available
        if (q.rationale) {
            html += `<div class="rationale-explanation">
                <span class="rationale-explanation-label">💡 Erklärung:</span>
                ${q.rationale}
            </div>`;
        }

        return html;
    }

    // ── Evaluate Answer ────────────────────────────────────
    function evaluateAnswer() {
        if (isEvaluated) return;
        stopQuestionTimer();
        isEvaluated = true;

        // Hide skip button as a decision has been made
        btnSkip.classList.add('hidden');

        const totalQuestions = activeQuestions.length;
        const q = activeQuestions[currentQuestionIndex];
        const allItems = optionsList.querySelectorAll('.option-item');
        const selectedIndices = [];

        allItems.forEach((item) => {
            const idx = parseInt(item.dataset.index, 10);
            const isSelected = item.classList.contains('selected');
            const isCorrect = q.correctAnswers.includes(idx);

            item.classList.add('evaluated');

            if (isSelected && isCorrect) {
                item.classList.add('correct');
                item.querySelector('.option-result-icon').innerHTML = checkSVG('#22c55e', 20);
                selectedIndices.push(idx);
            } else if (isSelected && !isCorrect) {
                item.classList.add('wrong');
                item.querySelector('.option-result-icon').innerHTML = crossSVG('#ef4444', 20);
                selectedIndices.push(idx);
            } else if (!isSelected && isCorrect) {
                item.classList.add('missed');
                item.querySelector('.option-result-icon').innerHTML = checkSVG('#22c55e', 18);
            } else {
                item.classList.add('neutral-evaluated');
            }
        });

        // Score: only full points if ALL correct answers selected and NO wrong answers selected
        const selectedSet = new Set(selectedIndices);
        const correctSet = new Set(q.correctAnswers);
        const isFullyCorrect =
            selectedSet.size === correctSet.size &&
            [...correctSet].every((i) => selectedSet.has(i));

        // Remove the question from the skipped list if it exists there, as it's now answered.
        const justAnsweredQuestion = activeQuestions[currentQuestionIndex];
        const indexInSkipped = skippedQuestions.findIndex(q => q.id === justAnsweredQuestion.id);
        if (indexInSkipped > -1) {
            skippedQuestions.splice(indexInSkipped, 1);
        }

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

        updateLiveScore();
        updateAvgTime();

        // Show rationale
        rationaleText.innerHTML = buildRationale(q, selectedIndices);
        rationaleBox.classList.remove('hidden');

        // Transform button to "Nächste Frage" or "Ergebnis anzeigen"
        const isLast = (currentQuestionIndex >= activeQuestions.length - 1) && (skippedQuestions.length === 0);
        btnCheck.disabled = false;
        btnCheck.classList.add('btn-next');

        if (isLast) {
            btnCheck.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Ergebnis anzeigen
      `;
        } else {
            btnCheck.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        Nächste Frage
      `;
        }
    }

    // ── Show Results ───────────────────────────────────────
    function showResults() {
        stopTimer();
        quizCompletionTime = new Date();
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
                        itemClass += ' correct';
                        indicator = isSelected ? '✓ Deine Wahl' : '✓ Richtige Antwort';
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

                const formattedTime = timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

                summaryItem.innerHTML = `
                    <div class="wrong-q-header">
                        <p class="wrong-q-text">${question.question}</p>
                        <span class="wrong-q-timestamp">${formattedTime} Uhr</span>
                    </div>
                    ${optionsHtml}
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
        skippedQuestions = [];
        isEvaluated = false;
        progressFill.style.width = '0%';
        progressInfo.classList.add('visible');
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        renderQuestion();
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
        skippedQuestions = [];
        isEvaluated = false;
        progressFill.style.width = '0%';
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        renderQuestion();
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
        skippedQuestions = [];
        incorrectAnswers = [];
        isEvaluated = false;

        // Reset UI elements and start the quiz
        progressFill.style.width = '0%';
        if (avgTimeDisplay) {
            avgTimeDisplay.style.display = 'flex';
        }
        updateLiveScore();
        startTimer();
        renderQuestion();
    }

    // ── Skip Question Logic ────────────────────────────────
    function skipQuestion() {
        if (isEvaluated) return;

        const q = activeQuestions[currentQuestionIndex];
        
        // Add to skipped queue if not already there (to handle skipping a skipped question again)
        if (!skippedQuestions.find(sq => sq.id === q.id)) {
            skippedQuestions.push(q);
        }

        // Move to the next logical question
        moveToNextQuestion();
    }

    function moveToNextQuestion() {
        currentQuestionIndex++;

        if (currentQuestionIndex >= activeQuestions.length) {
            // End of the current pass. Check for remaining skipped questions.
            if (skippedQuestions.length > 0) {
                // Start a new round with the remaining skipped questions.
                activeQuestions = shuffle(skippedQuestions);
                skippedQuestions = []; // Clear queue for this new pass
                currentQuestionIndex = 0;
                renderQuestion();
            } else {
                // No skipped questions left, we are done.
                showResults();
            }
        } else {
            // There are more questions in the current pass.
            renderQuestion();
        }
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

        // --- 3. Incorrect Answers Section ---
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
                
                const allOptionsText = [];
                question.options.forEach((opt, optIndex) => {
                    const isSelected = selectedSet.has(optIndex);
                    const isCorrect = correctSet.has(optIndex);
                    let indicator = '';
                    if (isSelected && !isCorrect) indicator = '(✗ Deine Wahl)';
                    else if (isSelected && isCorrect) indicator = '(✓ Deine Wahl)';
                    else if (!isSelected && isCorrect) indicator = '(✓ Richtig)';
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
                y += allOptionsLines.length * lineHeight + 8;
            });
        } else {
            checkPageBreak(10);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(34, 197, 94);
            doc.text("Perfekt! Du hast alle Fragen richtig beantwortet.", margin, y);
        }

        // --- 4. Save the PDF ---
        doc.setTextColor(0, 0, 0);
        doc.save('KI-Quiz-Ergebnisse.pdf');
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
        if (btnSkip) {
            btnSkip.classList.add('hidden');
        }
        if (resultCompletionTime) {
            resultCompletionTime.textContent = '';
        }
        showScreen(screenStart);
    }

    // ── Button Click Handlers ──────────────────────────────
    btnCheck.addEventListener('click', () => {
        if (!isEvaluated) {
            evaluateAnswer();
        } else {
            moveToNextQuestion();
        }
    });

    btnStart.addEventListener('click', () => startQuiz());
    btnRestart.addEventListener('click', () => restartQuiz());
    btnRetryIncorrect.addEventListener('click', () => retryIncorrect());
    btnSkip.addEventListener('click', skipQuestion);
    btnExportPdf.addEventListener('click', () => exportResultsToPdf());
    btnBackHome.addEventListener('click', () => goHome());

    btnQuizBack.addEventListener('click', () => {
        if (confirm('Möchtest du das Quiz wirklich abbrechen? Dein aktueller Fortschritt geht dabei verloren.')) {
            goHome();
        }
    });

    btnTimeupResult.addEventListener('click', () => {
        modalTimeup.classList.add('hidden');
        showResults();
    });

    // ── Initialize ─────────────────────────────────────────
    buildCategoryChips();

})();
