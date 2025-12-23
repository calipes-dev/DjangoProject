// ==================== ACE EDITOR SETUP ====================
let editor = ace.edit("codeEditor");
editor.setTheme("ace/theme/dracula");
editor.session.setMode("ace/mode/python");
editor.setOptions({
  enableBasicAutocompletion: true,
  enableLiveAutocompletion: true,
  fontSize: "14px",
  showPrintMargin: false,
  highlightActiveLine: true,
  tabSize: 4,
  useSoftTabs: true
});

const languageModes = {
  python: "ace/mode/python",
  c: "ace/mode/c_cpp",
  cpp: "ace/mode/c_cpp",
  java: "ace/mode/java"
};

// Language change handler with templates
document.getElementById("language").addEventListener("change", e => {
  editor.session.setMode(languageModes[e.target.value]);
  
  const templates = {
    python: '# Write your Python code below\ndef main():\n    # Your code here\n    pass\n\nif __name__ == "__main__":\n    main()',
    c: '#include <stdio.h>\n\nint main() {\n    // Your code here\n\n    return 0;\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n\n    return 0;\n}',
    java: '\npublic class Main {\n    public static void main(String[] args) {\n        // Your code here\n\n    }\n}'
  };
  
  editor.setValue(templates[e.target.value] || '', -1);
});

function getCode() { return editor.getValue(); }

// ==================== CONSOLE STATE ====================
let consoleState = {
  code: '',
  language: '',
  inputs: [],
  allInputs: '',
  isWaitingForInput: false,
  isFinished: false,
  needsInput: false,
  prompts: []
};

// ==================== IMPROVED UNIVERSAL BATCH INPUT HANDLER ====================
const UniversalHandler = {
  needsInput(code, language) {
    switch(language) {
      case 'python':
        return /input\s*\(/.test(code);
      case 'c':
        return /scanf\s*\(/.test(code);
      case 'cpp':
        return /cin\s*>>/.test(code);
      case 'java':
        return /Scanner/.test(code) && /\.next(Int|Line|Double|Float|Boolean|Long)\s*\(/.test(code);
      default:
        return false;
    }
  },
  
  countInputs(code, language) {
    let count = 0;
    switch(language) {
      case 'python':
        const pythonMatches = code.match(/input\s*\(/g);
        count = pythonMatches ? pythonMatches.length : 0;
        break;
      case 'c':
        const cMatches = code.match(/scanf/g);
        count = cMatches ? cMatches.length : 0;
        break;
      case 'cpp':
        const lines = code.split('\n');
        for (let line of lines) {
          if (line.includes('cin') && line.includes('>>')) {
            const matches = line.match(/>>/g);
            count += matches ? matches.length : 0;
          }
        }
        break;
      case 'java':
        const javaMatches = code.match(/\.next(Int|Line|Double|Float|Boolean|Long)\s*\(/g);
        count = javaMatches ? javaMatches.length : 0;
        break;
    }
    return count;
  },
  
  extractPrompts(code, language) {
    const prompts = [];
    const lines = code.split('\n');
    
    switch(language) {
      case 'python':
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('input(')) {
            const match = lines[i].match(/input\s*\(\s*["'`f]([^"'`]*)["'`]/);
            if (match) {
              let prompt = match[1]
                .replace(/\{[^}]+\}/g, '')
                .trim();
              prompts.push(prompt || `Value ${prompts.length + 1}`);
            } else {
              prompts.push(`Value ${prompts.length + 1}`);
            }
          }
        }
        break;
        
      case 'c':
        const scanfLines = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('scanf')) {
            scanfLines.push(i);
          }
        }
        
        for (let scanfLine of scanfLines) {
          let found = false;
          for (let j = scanfLine - 1; j >= Math.max(0, scanfLine - 5); j--) {
            if (lines[j].includes('printf')) {
              const match = lines[j].match(/printf\s*\(\s*["']([^"']*)["']/);
              if (match) {
                let prompt = match[1]
                  .replace(/%d|%s|%f|%c|%lf|%i/g, '')
                  .replace(/\\n/g, '')
                  .trim();
                if (prompt) {
                  prompts.push(prompt);
                  found = true;
                  break;
                }
              }
            }
          }
          if (!found) {
            prompts.push(`Value ${prompts.length + 1}`);
          }
        }
        break;
        
      case 'cpp':
        const cinLines = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('cin') && lines[i].includes('>>')) {
            const varCount = (lines[i].match(/>>/g) || []).length;
            cinLines.push({line: i, count: varCount});
          }
        }
        
        for (let {line: cinLine, count: varCount} of cinLines) {
          for (let v = 0; v < varCount; v++) {
            let found = false;
            for (let j = cinLine - 1; j >= Math.max(0, cinLine - 5); j--) {
              if (lines[j].includes('cout') && lines[j].includes('<<')) {
                const match = lines[j].match(/cout\s*<<\s*["']([^"']*)["']/);
                if (match) {
                  let prompt = match[1]
                    .replace(/\\n/g, '')
                    .trim();
                  if (prompt && !prompts.includes(prompt)) {
                    prompts.push(prompt);
                    found = true;
                    break;
                  }
                }
              }
            }
            if (!found) {
              prompts.push(`Value ${prompts.length + 1}`);
            }
          }
        }
        break;
        
      case 'java':
        const scannerLines = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/\.next(Int|Line|Double|Float|Boolean|Long)\s*\(/)) {
            scannerLines.push(i);
          }
        }
        
        for (let scannerLine of scannerLines) {
          let found = false;
          for (let j = scannerLine - 1; j >= Math.max(0, scannerLine - 5); j--) {
            if (lines[j].includes('System.out.print')) {
              const match = lines[j].match(/System\.out\.print\w*\s*\(\s*["']([^"']*)["']/);
              if (match) {
                let prompt = match[1].trim();
                if (prompt) {
                  prompts.push(prompt);
                  found = true;
                  break;
                }
              }
            }
          }
          if (!found) {
            prompts.push(`Value ${prompts.length + 1}`);
          }
        }
        break;
    }
    
    return prompts;
  },
  
  getInputPrompt(code, language) {
    const count = this.countInputs(code, language);
    return count > 0 
      ? `Enter all ${count} value(s) (space-separated or one per line):`
      : 'Enter values:';
  }
};

// ==================== CONSOLE UI FUNCTIONS ====================
function appendToConsole(text, inline = false, className = '') {
  const consoleOutput = document.getElementById('consoleOutput');
  
  const processedText = text
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');
  
  if (inline) {
    const span = document.createElement('span');
    span.className = className || 'prompt-line';
    span.textContent = processedText;
    consoleOutput.appendChild(span);
  } else {
    const textNode = document.createTextNode(processedText);
    consoleOutput.appendChild(textNode);
  }
  
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
  document.getElementById('consoleOutput').innerHTML = '';
}

function updateHelpText(text) {
  document.getElementById('inputHelp').textContent = text;
}

// ==================== WAITING INDICATOR FUNCTIONS ====================
function showWaitingIndicator(text = 'Processing...', subtext = 'Please wait') {
  const waitingIndicator = document.getElementById('waitingIndicator');
  const waitingText = document.getElementById('waitingText');
  const waitingSubtext = document.getElementById('waitingSubtext');
  
  waitingText.textContent = text;
  waitingSubtext.textContent = subtext;
  waitingIndicator.classList.remove('hidden');
}

function hideWaitingIndicator() {
  const waitingIndicator = document.getElementById('waitingIndicator');
  waitingIndicator.classList.add('hidden');
}

// ==================== INPUT HANDLING ====================
document.getElementById('consoleInput').addEventListener('keydown', function(e) {
  if (!consoleState.isFinished && consoleState.isWaitingForInput) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
    }
  }
});

function submitInput() {
  if (consoleState.isFinished || !consoleState.isWaitingForInput) {
    return;
  }
  
  const input = document.getElementById('consoleInput');
  const inputText = input.value.trim();
  
  if (!inputText) {
    return;
  }
  
  let values = [];
  
  if (inputText.includes('\n')) {
    values = inputText.split('\n').map(v => v.trim()).filter(v => v);
  } else {
    values = inputText.split(/\s+/).filter(v => v);
  }
  
  for (let i = 0; i < values.length; i++) {
    const prompt = consoleState.prompts[i] || `Value ${i + 1}`;
    const cleanPrompt = prompt.replace(/:?\s*$/, '');
    appendToConsole(`${cleanPrompt}: `, true, 'prompt-line');
    appendToConsole(`${values[i]}\n`, true, 'input-value');
  }
  
  consoleState.allInputs = values.join('\n');
  consoleState.inputs = values;
  
  input.value = '';
  input.disabled = true;
  document.getElementById('submitInputIcon').style.display = 'none';
  consoleState.isWaitingForInput = false;
  
  hideWaitingIndicator();
  showWaitingIndicator('Processing input...', 'Running your code...');
  
  setTimeout(() => {
    executeCode();
  }, 100);
}

// ==================== CODE EXECUTION ====================
async function executeCode() {
  try {
    // Get CSRF token
    const csrftoken = getCookie('csrftoken');
    
    const response = await fetch("/run-test-code/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken
      },
      body: JSON.stringify({
        code: consoleState.code,
        language: consoleState.language,
        stdin: consoleState.allInputs
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      const output = data.output || '';
      const stderr = data.stderr || '';
      const compileError = data.compile_error || '';
      
      if (compileError) {
        appendToConsole('\n--- Compile Error ---\n', false, 'error');
        appendToConsole(compileError);
        finishExecution();
        return;
      }
      
      if (stderr) {
        appendToConsole('\n--- Runtime Error ---\n', false, 'error');
        appendToConsole(stderr);
        finishExecution();
        return;
      }
      
      if (output) {
        appendToConsole(output);
      } else {
        appendToConsole('(No output)\n', false, 'info');
      }
      
      finishExecution();
      
    } else {
      appendToConsole('\n⚠️ Error: ' + (data.error || 'Unknown error') + '\n', false, 'error');
      finishExecution();
    }
    
  } catch (error) {
    appendToConsole('\n⚠️ Connection error: ' + error.message + '\n', false, 'error');
    finishExecution();
  }
}

function finishExecution() {
  consoleState.isFinished = true;
  consoleState.isWaitingForInput = false;
  document.getElementById('consoleInput').disabled = true;
  document.getElementById('submitInputIcon').style.display = 'none';
  
  hideWaitingIndicator();
  updateHelpText('Execution finished. Click Rerun to run again or Close to exit.');
  
  document.getElementById('rerunBtn').disabled = false;
}

// ==================== RERUN CODE ====================
function rerunCode() {
  const code = getCode();
  const language = document.getElementById('language').value;
  
  if (!code.trim()) {
    alert('⚠️ Code cannot be empty!');
    return;
  }
  
  const needsInput = UniversalHandler.needsInput(code, language);
  const prompts = UniversalHandler.extractPrompts(code, language);
  
  consoleState = {
    code: code,
    language: language,
    inputs: [],
    allInputs: '',
    isWaitingForInput: needsInput,
    isFinished: false,
    needsInput: needsInput,
    prompts: prompts
  };
  
  document.getElementById('rerunBtn').disabled = true;
  clearConsole();
  
  if (needsInput) {
    const input = document.getElementById('consoleInput');
    const submitIcon = document.getElementById('submitInputIcon');
    input.disabled = false;
    input.value = '';
    submitIcon.style.display = 'block';
    
    const prompt = UniversalHandler.getInputPrompt(code, language);
    const count = UniversalHandler.countInputs(code, language);
    
    document.getElementById('batchInputInfo').style.display = 'block';
    input.setAttribute('rows', '3');
    input.style.height = 'auto';
    input.style.minHeight = '70px';
    updateHelpText('Enter values separated by spaces or one per line, then press Enter');
    
    input.focus();
  } else {
    const input = document.getElementById('consoleInput');
    const submitIcon = document.getElementById('submitInputIcon');
    input.disabled = true;
    submitIcon.style.display = 'none';
    input.removeAttribute('rows');
    input.style.height = '';
    input.style.minHeight = '';
    document.getElementById('batchInputInfo').style.display = 'none';
    updateHelpText('Executing code (no input required)...');
    
    setTimeout(() => {
      executeCode();
    }, 100);
  }
}

// ==================== RUN CODE (OPENS CONSOLE) ====================
function runCode() {
  const code = getCode();
  const language = document.getElementById('language').value;
  
  if (!code.trim()) {
    alert('⚠️ Code cannot be empty!');
    return;
  }
  
  const needsInput = UniversalHandler.needsInput(code, language);
  const prompts = UniversalHandler.extractPrompts(code, language);
  
  consoleState = {
    code: code,
    language: language,
    inputs: [],
    allInputs: '',
    isWaitingForInput: needsInput,
    isFinished: false,
    needsInput: needsInput,
    prompts: prompts
  };
  
  document.getElementById('consoleModal').classList.add('active');
  
  document.getElementById('rerunBtn').disabled = true;
  clearConsole();
  
  if (needsInput) {
    const input = document.getElementById('consoleInput');
    const submitIcon = document.getElementById('submitInputIcon');
    input.disabled = false;
    input.value = '';
    submitIcon.style.display = 'block';
    
    const prompt = UniversalHandler.getInputPrompt(code, language);
    const count = UniversalHandler.countInputs(code, language);
    
    document.getElementById('batchInputInfo').style.display = 'block';
    input.setAttribute('rows', '3');
    input.style.height = 'auto';
    input.style.minHeight = '70px';
    updateHelpText('Enter values separated by spaces or one per line, then press Enter');
    
    input.focus();
  } else {
    const input = document.getElementById('consoleInput');
    const submitIcon = document.getElementById('submitInputIcon');
    input.disabled = true;
    submitIcon.style.display = 'none';
    input.removeAttribute('rows');
    input.style.height = '';
    input.style.minHeight = '';
    document.getElementById('batchInputInfo').style.display = 'none';
    updateHelpText('Executing code (no input required)...');
    
    setTimeout(() => {
      executeCode();
    }, 100);
  }
}

function closeConsole() {
  document.getElementById('consoleModal').classList.remove('active');
}

// ==================== CHECK CODE FUNCTION ====================
function getProblemTestCount() {
  const meta = document.getElementById('problemMeta');
  return parseInt(meta?.dataset?.testCount || '0', 10);
}

function animateTestUpdates(testResults) {
  const totalPoints = getProblemTestCount() * 10;
  let runningScore = 0;

  testResults.forEach((res, idx) => {
    const delay = idx * 350;
    setTimeout(() => {
      const id = `tcStatus${idx+1}`;
      const el = document.getElementById(id);
      if (!el) return;
      if (res === true) {
        el.className = 'badge-status badge-success';
        el.textContent = `PASSED`;
        runningScore += 10;
      } else if (res === false) {
        el.className = 'badge-status badge-danger';
        el.textContent = `FAILED`;
      } else {
        el.className = 'badge-status badge-secondary';
        el.textContent = `Hidden`;
      }
      document.getElementById('studentScoreValue').textContent = runningScore;
      document.getElementById('studentScoreTotal').textContent = totalPoints;
    }, delay);
  });
}

function parseResultSummary(resultSummary) {
  const lines = (resultSummary || '').split('\n');
  const testCount = getProblemTestCount();
  const results = new Array(testCount).fill(null);
  lines.forEach(line => {
    const m = line.match(/Test\s*(\d+):\s*(Passed|Failed|Error)/i);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      const status = m[2].toLowerCase();
      if (status === 'passed') results[idx] = true;
      else results[idx] = false;
    }
  });
  return results;
}

async function checkCode() {
  const modalOutput = document.getElementById('checkResult');
  const checkLoading = document.getElementById('checkLoading');

  modalOutput.textContent = "";
  checkLoading.style.display = "flex";

  try {
    const code = getCode();
    const lang = document.getElementById('language').value;
    const problemMeta = document.getElementById('problemMeta');
    const problemId = problemMeta ? problemMeta.dataset.problemId : '';
    
    // Get CSRF token
    const csrftoken = getCookie('csrftoken');

    const response = await fetch("/run_playground_code/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken
      },
      body: JSON.stringify({
        code: code,
        language: lang,
        check_mode: true,
        problem_id: problemId,
        stdin: ""
      })
    });

    const data = await response.json();
    checkLoading.style.display = "none";

    if (data.success) {
  const testResults = parseResultSummary(data.result_summary);
  animateTestUpdates(testResults);
  
  // Clear modal
  modalOutput.innerHTML = '';
  
  // Create success message
  const successDiv = document.createElement('div');
  successDiv.className = 'text-success mb-3';
  successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Code check completed successfully!';
  
  // Create results container
  const resultsDiv = document.createElement('div');
  resultsDiv.className = 'text-light';
  resultsDiv.innerHTML = '<strong>Results:</strong>';
  
  // Create pre element for results - clean the text first
  const resultsPre = document.createElement('pre');
  resultsPre.style.cssText = 'color: #e2e8f0; background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; word-wrap: break-word;';
  
  // Clean the result summary by removing problematic characters
  const cleanedResults = (data.result_summary || 'All tests passed!')
    .replace(/[^\x20-\x7E\n\r\t]/g, ''); // Remove non-printable characters except newlines and tabs
  
  resultsPre.textContent = cleanedResults;
  resultsDiv.appendChild(resultsPre);
  
  // Create info message
  const infoDiv = document.createElement('div');
  infoDiv.className = 'mt-3 text-info';
  infoDiv.innerHTML = '<i class="fas fa-info-circle"></i> Check the test cases panel for detailed results.';
  
  // Append all elements
  modalOutput.appendChild(successDiv);
  modalOutput.appendChild(resultsDiv);
  modalOutput.appendChild(infoDiv);
  
  // Show submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.style.display = 'inline-block';
  }
  
  const submitContainer = document.getElementById('submitButtonContainer');
  if (submitContainer) {
    submitContainer.classList.remove('hidden');
  }
} else {
      modalOutput.innerHTML = `
        <div class="text-danger">
          <i class="fas fa-exclamation-triangle"></i> Error: ${data.error || 'Unknown error occurred'}
        </div>
      `;
    }
  } catch (error) {
    checkLoading.style.display = "none";
    modalOutput.innerHTML = `
      <div class="text-danger">
        <i class="fas fa-exclamation-triangle"></i> Connection error: ${error.message}
      </div>
    `;
  }
}

// =============================
// SECURITY: Single submission lock
// =============================
let submissionInProgress = false;
let hasSubmitted = false;
let wasMaximized = false;
let focusLostTime = null;

// =============================
// IMPROVED WINDOW STATE MONITORING
// =============================
(function monitorWindowState() {
  function isInFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }
  
  function isWindowMaximized() {
    const tolerance = 50;
    const widthMaxed = window.outerWidth >= (window.screen.availWidth - tolerance);
    const heightMaxed = window.outerHeight >= (window.screen.availHeight - tolerance);
    return widthMaxed && heightMaxed;
  }
  
  function getWindowState() {
    return {
      isFullscreen: isInFullscreen(),
      isMaximized: isWindowMaximized(),
      width: window.outerWidth,
      height: window.outerHeight,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      documentVisible: !document.hidden,
      hasFocus: document.hasFocus()
    };
  }
  
  wasMaximized = isWindowMaximized() || isInFullscreen();
  
  setTimeout(() => {
    const state = getWindowState();
    if (!state.isMaximized && !state.isFullscreen && !hasSubmitted) {
      alert(
        "⚠️ Please MAXIMIZE your browser window or press F11 for fullscreen.\n\n" +
        "Your window must stay maximized throughout the activity."
      );
    }
  }, 1000);
  
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    
    resizeTimeout = setTimeout(() => {
      if (hasSubmitted) return;
      
      const state = getWindowState();
      const currentlyMaximized = state.isMaximized || state.isFullscreen;
      
      if (wasMaximized && !currentlyMaximized) {
        console.log("Window un-maximized detected!");
        autoSubmit("Window was resized or un-maximized", false);
        alert("🚫 Window resize detected! Your code has been submitted.");
        redirectToClass();
      }
      
      wasMaximized = currentlyMaximized;
    }, 300);
  });
  
  setInterval(() => {
    if (hasSubmitted) return;
    
    const state = getWindowState();
    const currentlyMaximized = state.isMaximized || state.isFullscreen;
    
    if (wasMaximized && !currentlyMaximized) {
      console.log("Periodic check: Window no longer maximized!");
      autoSubmit("Window no longer maximized", false);
      alert("🚫 Your browser window must stay maximized! Code submitted.");
      redirectToClass();
    }
  }, 2000);
  
  console.log("Initial window state:", getWindowState());
})();

// =============================
// DETECT WINDOW COVERAGE
// =============================
(function detectWindowCoverage() {
  let consecutiveFocusLoss = 0;
  
  document.addEventListener("visibilitychange", function() {
    if (document.hidden && !hasSubmitted) {
      focusLostTime = Date.now();
      console.log("Document hidden - immediate auto-submit");
      
      autoSubmit("Tab switched or window covered", false);
      alert("🚫 Tab switch or window coverage detected! Code submitted.");
      redirectToClass();
    }
  });
  
  let blurTimeout;
  window.addEventListener("blur", function() {
    if (hasSubmitted) return;
    
    blurTimeout = setTimeout(() => {
      if (!document.hasFocus() && !hasSubmitted) {
        consecutiveFocusLoss++;
        console.log(`Focus lost - auto-submitting`);
        
        autoSubmit("Window lost focus", false);
        alert("🚫 Focus lost! Your code has been submitted.");
        redirectToClass();
      }
    }, 500);
  });
  
  window.addEventListener("focus", function() {
    clearTimeout(blurTimeout);
    consecutiveFocusLoss = 0;
  });
})();

// =============================
// DETECT FULLSCREEN EXIT
// =============================
(function detectFullscreenExit() {
  function onFullscreenChange() {
    if (hasSubmitted) return;
    
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    if (!isFullscreen && wasMaximized) {
      setTimeout(() => {
        const isMaximized = 
          window.outerWidth >= (window.screen.availWidth - 50) &&
          window.outerHeight >= (window.screen.availHeight - 50);
        
        if (!isMaximized && !hasSubmitted) {
          console.log("Exited fullscreen and not maximized");
          autoSubmit("Exited fullscreen without maximizing", false);
          alert("🚫 You exited fullscreen! Code submitted.");
          redirectToClass();
        }
      }, 500);
    }
  }
  
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('mozfullscreenchange', onFullscreenChange);
  document.addEventListener('MSFullscreenChange', onFullscreenChange);
})();

// =============================
// DETECT MULTIPLE WINDOWS/TABS
// =============================
(function detectMultipleInstances() {
  const problemMeta = document.getElementById('problemMeta');
  const problemId = problemMeta ? problemMeta.dataset.problemId : '';
  
  if (!problemId) return;
  
  const instanceKey = `instance_${problemId}`;
  const instanceId = Date.now() + '_' + Math.random();
  
  try {
    const existingInstance = sessionStorage.getItem(instanceKey);
    if (existingInstance && existingInstance !== instanceId) {
      alert("🚫 This problem is already open in another window/tab!");
      autoSubmit("Multiple windows detected", false);
      redirectToClass();
      return;
    }
    
    sessionStorage.setItem(instanceKey, instanceId);
    
    const checkInterval = setInterval(() => {
      const currentInstance = sessionStorage.getItem(instanceKey);
      if (currentInstance !== instanceId && !hasSubmitted) {
        clearInterval(checkInterval);
        alert("🚫 Another window opened the same problem!");
        autoSubmit("Multiple windows detected", false);
        redirectToClass();
      }
    }, 1000);
    
    window.addEventListener('beforeunload', function() {
      if (sessionStorage.getItem(instanceKey) === instanceId) {
        sessionStorage.removeItem(instanceKey);
      }
    });
  } catch (e) {
    console.error("Instance detection error:", e);
  }
})();

// =============================
// HELPER FUNCTIONS
// =============================
function redirectToClass() {
  setTimeout(() => {
    // ✅ Get classId from the data attribute you added to the template
    const problemMeta = document.getElementById('problemMeta');
    const classId = problemMeta ? problemMeta.dataset.classId : '';
    
    if (classId) {
      window.location.href = `/student/class/${classId}/`;
    } else {
      // Fallback to classes list
      window.location.href = "/student/classes/";
    }
  }, 100);
}

// =============================
// UNIFIED AUTO-SUBMIT FUNCTION
// =============================
function autoSubmit(reason = "Security trigger", shouldRedirect = true) {
  if (submissionInProgress || hasSubmitted) {
    return false;
  }
  
  submissionInProgress = true;
  hasSubmitted = true;
  console.log(`Auto-submit triggered: ${reason}`);

  const problemMeta = document.getElementById('problemMeta');
  const problemId = problemMeta ? problemMeta.dataset.problemId : '';
  
  if (!problemId) {
    console.error("Problem ID not found");
    return false;
  }

  const code = getCode();
  const lang = document.getElementById('language').value;

  try {
    sessionStorage.setItem(`submitted_${problemId}`, 'true');
  } catch (e) {
    console.error("SessionStorage error:", e);
  }

  const data = JSON.stringify({
    problem_id: problemId,
    code: code,
    language: lang,
    auto_submit: true,
    reason: reason
  });

  const url = `/submit_problem/${problemId}/`;
  const blob = new Blob([data], { type: 'application/json' });
  const sent = navigator.sendBeacon(url, blob);
  
  if (sent && shouldRedirect) {
    setTimeout(() => {
      redirectToClass();
    }, 500);
  }

  return sent;
}

// =============================
// MANUAL SUBMIT
// =============================

async function submitCode() {
  if (submissionInProgress || hasSubmitted) {
    alert("Submission already in progress.");
    return;
  }

  const checkResultDiv = document.getElementById('checkResult');
  const checkLoading = document.getElementById('checkLoading');

  checkResultDiv.textContent = "";
  checkLoading.style.display = "flex";
  submissionInProgress = true;

  try {
    const code = getCode();
    const problemMeta = document.getElementById('problemMeta');
    const problemId = problemMeta ? problemMeta.dataset.problemId : '';
    const lang = document.getElementById('language').value;
    
    if (!problemId) {
      throw new Error("Problem ID not found");
    }

    const csrftoken = getCookie('csrftoken');

    const response = await fetch(`/submit_problem/${problemId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken
      },
      body: JSON.stringify({
        problem_id: problemId,
        code: code,
        language: lang
      })
    });

    const data = await response.json();
    checkLoading.style.display = "none";

    if (data.success) {
      const testResults = parseResultSummary(data.result_summary);
      animateTestUpdates(testResults);

      const finalScore = data.score ?? (testResults.filter(Boolean).length * 10);
      document.getElementById('studentScoreValue').textContent = finalScore;
      document.getElementById('studentScoreTotal').textContent = (getProblemTestCount() * 10);

      // Clean the result summary by removing problematic characters
      const cleanedSummary = (data.result_summary || '')
        .replace(/[^\x20-\x7E\n\r\t]/g, '');
      
      const resultPre = document.createElement('pre');
      resultPre.style.color = '#28a745';
      resultPre.textContent = cleanedSummary;
      checkResultDiv.innerHTML = '';
      checkResultDiv.appendChild(resultPre);

      hasSubmitted = true;

      // ✅ FIX: Get classId from problemMeta dataset
      setTimeout(() => {
        const classId = problemMeta ? problemMeta.dataset.classId : '';
        
        if (classId) {
          window.location.href = `/student/class/${classId}/`;
        } else {
          window.location.href = data.redirect_url || "/student/classes/";
        }
      }, 1500);
    } else {
      submissionInProgress = false;
      checkResultDiv.textContent = "⚠️ " + (data.message || "Submission failed.");
    }
  } catch (error) {
    checkLoading.style.display = "none";
    submissionInProgress = false;
    checkResultDiv.textContent = "⚠️ Submission failed: " + error.message;
    console.error(error);
  }
}
// =============================
// TIMER WITH PERSISTENCE
// =============================
(function startCountdown() {
  const timerMeta = document.getElementById('problemTimer');
  if (!timerMeta) return;

  const timeLimitMinutes = parseInt(timerMeta.dataset.timelimit || '0', 10);
  if (isNaN(timeLimitMinutes) || timeLimitMinutes <= 0) return;

  const timeCard = document.getElementById('timeLeftCard');
  const timerDisplay = document.getElementById('timeLeftDisplay');
  
  if (timeCard) {
    timeCard.style.display = 'block';
  }
  
  const problemMeta = document.getElementById('problemMeta');
  const problemId = problemMeta ? problemMeta.dataset.problemId : '';
  const timerKey = `timer_${problemId}`;
  
  let deadline;
  const savedDeadline = sessionStorage.getItem(timerKey);
  
  if (savedDeadline) {
    deadline = new Date(parseInt(savedDeadline, 10));
    console.log("Restored timer deadline:", deadline);
  } else {
    deadline = new Date(Date.now() + timeLimitMinutes * 60 * 1000);
    sessionStorage.setItem(timerKey, deadline.getTime().toString());
    console.log("Created new timer deadline:", deadline);
  }

  const tick = setInterval(() => {
    const now = new Date();
    const remaining = Math.floor((deadline - now) / 1000);

    if (remaining <= 0) {
      clearInterval(tick);
      if (timerDisplay) {
        timerDisplay.textContent = "00:00";
        timerDisplay.classList.add('danger');
      }
      
      sessionStorage.removeItem(timerKey);
      
      autoSubmit("Time limit exceeded");
      alert("Time is up! Your code has been submitted automatically.");
      
      setTimeout(() => {
        redirectToClass();
      }, 1000);
      return;
    }

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    
    if (timerDisplay) {
      timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      
      timerDisplay.classList.remove('warning', 'danger');
      
      if (remaining <= 60) {
        timerDisplay.classList.add('danger');
      } else if (remaining <= 300) {
        timerDisplay.classList.add('warning');
      }
    }
  }, 1000);
})();

// =============================
// SECURITY EVENT HANDLERS
// =============================
(function preventBackNavigation() {
  history.pushState(null, null, location.href);
  window.onpopstate = function () {
    history.pushState(null, null, location.href);
    autoSubmit("Back navigation attempt");
    alert("🚫 Navigation blocked. Your code has been submitted.");
    setTimeout(() => {
      redirectToClass();
    }, 500);
  };
})();

window.addEventListener("beforeunload", function(e) {
  if (!hasSubmitted) {
    e.preventDefault();
    e.returnValue = "⚠️ Are you sure you want to leave? Your progress will be saved but refreshing multiple times may result in auto-submission.";
    return "⚠️ Are you sure you want to leave?";
  }
});

window.addEventListener("pagehide", function(e) {
  if (!hasSubmitted && !e.persisted) {
    autoSubmit("Page closed");
  }
});

document.addEventListener("contextmenu", function(e) {
  e.preventDefault();
});

document.addEventListener("keydown", function(e) {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && ["U", "S"].includes(e.key.toUpperCase()))
  ) {
    e.preventDefault();
    autoSubmit("Dev tools attempt");
  }
});

// =============================
// INITIAL SECURITY WARNING & SUBMISSION CHECK
// =============================
(function checkSubmissionStatus() {
  const problemMeta = document.getElementById('problemMeta');
  const problemId = problemMeta ? problemMeta.dataset.problemId : '';
  
  if (!problemId) return;
  
  // Check if there's a clear flag (this would need to be passed from backend)
  const clearFlag = document.body.dataset.clearSessionFlag === 'true';
  
  if (clearFlag) {
    try {
      sessionStorage.removeItem(`submitted_${problemId}`);
      sessionStorage.removeItem(`rules_${problemId}`);
      console.log("SessionStorage flags cleared - fresh attempt allowed by teacher");
    } catch (e) {
      console.error("SessionStorage error:", e);
    }
  }
  
  try {
    const wasSubmitted = sessionStorage.getItem(`submitted_${problemId}`) === 'true';
    console.log("Session storage says submitted:", wasSubmitted);
    
    if (wasSubmitted && !clearFlag) {
      alert("This problem has already been submitted in this session.");
      redirectToClass();
      return;
    }
  } catch (e) {
    console.error("SessionStorage error:", e);
  }
  
  try {
    const rulesAccepted = sessionStorage.getItem(`rules_${problemId}`);
    
    console.log("Rules accepted:", rulesAccepted);
    
    if (!rulesAccepted) {
      alert(
        "⚠️ ACTIVITY SECURITY RULES ⚠️\n\n" +
        "• Keep your browser MAXIMIZED or in FULLSCREEN (F11)\n" +
        "• DO NOT resize the browser window\n" +
        "• DO NOT open other applications on top of this window\n" +
        "• DO NOT switch tabs or windows\n" +
        "• DO NOT split screen\n" +
        "• Window must remain VISIBLE and FOCUSED at all times\n\n" +
        "⚠️ Violating any rule will AUTO-SUBMIT your code!\n\n" +
        "Click OK to accept and continue."
      );
      
      sessionStorage.setItem(`rules_${problemId}`, 'accepted');
      console.log("Security rules accepted - continuing...");
    }
  } catch (e) {
    console.error("Rules check error:", e);
  }
  
  console.log("Visibility API supported:", typeof document.hidden !== "undefined");
  console.log("Initial document.hidden:", document.hidden);
  console.log("Initial hasSubmitted:", hasSubmitted);
  console.log("Clear flag:", clearFlag);
})();

// =============================
// VISUAL DEBUG INDICATOR
// =============================
(function addDebugIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'securityIndicator';
  indicator.style.cssText = 
    'position:fixed;bottom:10px;left:10px;background:#1a1a1a;color:white;' +
    'padding:10px;border-radius:8px;z-index:9999;font-size:11px;' +
    'font-family:monospace;min-width:200px;border:2px solid #333;' +
    'box-shadow:0 4px 6px rgba(0,0,0,0.3);';
  document.body.appendChild(indicator);
  
  function updateIndicator() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    const isMaximized = 
      window.outerWidth >= (window.screen.availWidth - 50) &&
      window.outerHeight >= (window.screen.availHeight - 50);
    
    const isHidden = document.hidden;
    const hasFocus = document.hasFocus();
    
    let status = '🟢 SECURE';
    let color = '#1a5f1a';
    
    if (isHidden) {
      status = '🔴 HIDDEN';
      color = '#8b0000';
    } else if (!hasFocus) {
      status = '🟠 NO FOCUS';
      color = '#8b4500';
    } else if (!isMaximized && !isFullscreen) {
      status = '🟠 NOT MAXIMIZED';
      color = '#8b6500';
    }
    
    indicator.style.background = color;
    indicator.innerHTML = `
      <div style="font-weight:bold;margin-bottom:5px;">${status}</div>
      <div>✅ Maximized: ${isMaximized ? 'Yes' : '<span style="color:#ff6b6b;">No</span>'}</div>
      <div>📲 Fullscreen: ${isFullscreen ? 'Yes' : '<span style="color:#ff6b6b;">No</span>'}</div>
      <div>👁️ Visible: ${!isHidden ? 'Yes' : '<span style="color:#ff6b6b;">No</span>'}</div>
      <div>🎯 Focused: ${hasFocus ? 'Yes' : '<span style="color:#ff6b6b;">No</span>'}</div>
    `;
  }
  
  document.addEventListener("visibilitychange", updateIndicator);
  window.addEventListener('resize', updateIndicator);
  window.addEventListener('focus', updateIndicator);
  window.addEventListener('blur', updateIndicator);
  
  document.addEventListener('fullscreenchange', updateIndicator);
  document.addEventListener('webkitfullscreenchange', updateIndicator);
  document.addEventListener('mozfullscreenchange', updateIndicator);
  document.addEventListener('MSFullscreenChange', updateIndicator);
  
  setInterval(updateIndicator, 1000);
  setTimeout(updateIndicator, 500);
})();

// =============================
// CSRF TOKEN HELPER
// =============================
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// =============================
// MODAL FUNCTIONS
// =============================
function openCheckModal() {
  document.getElementById('checkModal').classList.add('active');
}

function closeCheckModal() {
  document.getElementById('checkModal').classList.remove('active');
}