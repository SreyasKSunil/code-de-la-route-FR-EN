const state = {
  view: "learn",
  langMode: "FR_FIRST",
  theme: localStorage.getItem("cr_theme") || "dark",
  showEnglishFirst: localStorage.getItem("cr_en_first") === "1",
  showHints: localStorage.getItem("cr_hints") !== "0",
  search: "",
  data: {
    modules: [],
    signs: [],
    rules: [],
    vocab: [],
    questions: []
  },
  progress: loadProgress()
};

function loadProgress(){
  try{
    return JSON.parse(localStorage.getItem("cr_progress") || "{}");
  } catch(e){
    return {};
  }
}
function saveProgress(){
  localStorage.setItem("cr_progress", JSON.stringify(state.progress));
}
function bumpProgress(key, delta = 1){
  const cur = Number(state.progress[key] || 0);
  state.progress[key] = cur + delta;
  saveProgress();
  render();
}

function setTheme(theme){
  state.theme = theme;
  localStorage.setItem("cr_theme", theme);
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

function setLangMode(){
  state.langMode = state.langMode === "FR_FIRST" ? "EN_FIRST" : "FR_FIRST";
  render();
}

function setEnglishFirstSetting(v){
  state.showEnglishFirst = v;
  localStorage.setItem("cr_en_first", v ? "1" : "0");
  render();
}
function setHintsSetting(v){
  state.showHints = v;
  localStorage.setItem("cr_hints", v ? "1" : "0");
  render();
}

function el(tag, attrs = {}, children = []){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if(k === "class") node.className = v;
    else if(k === "text") node.textContent = v;
    else if(k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(ch => node.appendChild(ch));
  return node;
}

function bilingualBlock(fr, en, tip){
  const englishFirst = state.showEnglishFirst;
  const frNode = el("div", { class: "fr", text: fr });
  const enNode = el("div", { class: "en", text: en });

  const block = el("div", { class: "bilingual" }, englishFirst ? [enNode, frNode] : [frNode, enNode]);

  if(state.showHints && tip){
    block.appendChild(el("div", { class: "tip", text: "Exam tip: " + tip }));
  }
  return block;
}

function normalize(s){
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function matchesSearch(item){
  const q = normalize(state.search);
  if(!q) return true;
  const hay = normalize(
    [
      item.title_fr, item.title_en,
      item.fr, item.en,
      item.keywords ? item.keywords.join(" ") : "",
      item.category || "",
      item.type || ""
    ].join(" ")
  );
  return hay.includes(q);
}

async function loadAll(){
  const [modules, signs, rules, vocab, questions] = await Promise.all([
    fetch("data/modules.json").then(r => r.json()),
    fetch("data/signs.json").then(r => r.json()),
    fetch("data/rules.json").then(r => r.json()),
    fetch("data/vocab.json").then(r => r.json()),
    fetch("data/questions.json").then(r => r.json())
  ]);
  state.data.modules = modules;
  state.data.signs = signs;
  state.data.rules = rules;
  state.data.vocab = vocab;
  state.data.questions = questions;
  render();
}

function setActiveNav(view){
  document.querySelectorAll(".navItem").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
}

function setHeader(title, sub){
  document.getElementById("viewTitle").textContent = title;
  document.getElementById("viewSub").textContent = sub;
}

function render(){
  setTheme(state.theme);

  const area = document.getElementById("contentArea");
  area.innerHTML = "";

  setActiveNav(state.view);

  if(state.view === "learn") renderLearn(area);
  if(state.view === "signs") renderSigns(area);
  if(state.view === "rules") renderRules(area);
  if(state.view === "vocab") renderVocab(area);
  if(state.view === "flashcards") renderFlashcards(area);
  if(state.view === "quiz") renderQuiz(area);
  if(state.view === "progress") renderProgress(area);
}

function renderLearn(area){
  setHeader("Learn", "Pick a module. Study FR with EN support. Mark items as learned.");
  const modules = state.data.modules;

  const wrap = el("div", { class: "grid" });
  modules.forEach(m => {
    const learnedKey = `module:${m.id}:opened`;
    const opened = Number(state.progress[learnedKey] || 0);

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardHeader" }, [
        el("div", {}, [
          el("div", { class: "cardTitle", text: m.title_fr }),
          el("div", { class: "line", text: m.title_en })
        ]),
        el("div", { class: "pill", text: opened > 0 ? "Started" : "New" })
      ]),
      el("div", { class: "stack" }, [
        bilingualBlock(m.desc_fr, m.desc_en, m.tip),
        el("div", { class: "actions" }, [
          el("button", { class: "btn primary", text: "Open module", onclick: () => openModule(m.id) }),
          el("button", { class: "btn", text: "Mark as started", onclick: () => bumpProgress(learnedKey, 1) })
        ])
      ])
    ]);
    wrap.appendChild(card);
  });

  area.appendChild(wrap);

  if(state.search){
    area.appendChild(el("div", { class: "hr" }));
    area.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "Search results" }),
      el("div", { class: "line", text: "Filtered by your search input. Use navigation to view categories." })
    ]));
  }
}

function openModule(id){
  bumpProgress(`module:${id}:opened`, 1);
  const m = state.data.modules.find(x => x.id === id);
  if(!m) return;

  const area = document.getElementById("contentArea");
  area.innerHTML = "";

  setHeader(m.title_fr, m.title_en);

  const items = [];
  if(m.includes.includes("signs")) items.push(...state.data.signs.filter(s => m.tags.some(t => (s.tags || []).includes(t))));
  if(m.includes.includes("rules")) items.push(...state.data.rules.filter(r => m.tags.some(t => (r.tags || []).includes(t))));
  if(m.includes.includes("vocab")) items.push(...state.data.vocab.filter(v => m.tags.some(t => (v.tags || []).includes(t))));

  const filtered = items.filter(matchesSearch);

  const top = el("div", { class: "card" }, [
    bilingualBlock(m.desc_fr, m.desc_en, m.tip),
    el("div", { class: "actions" }, [
      el("button", { class: "btn", text: "Back to modules", onclick: () => { state.view = "learn"; render(); } }),
      el("button", { class: "btn primary", text: "Study with flashcards", onclick: () => { state.view = "flashcards"; state.progress["flashcards:sourceModule"] = id; saveProgress(); render(); } }),
      el("button", { class: "btn", text: "Practice quiz", onclick: () => { state.view = "quiz"; state.progress["quiz:sourceModule"] = id; saveProgress(); render(); } })
    ])
  ]);

  area.appendChild(top);
  area.appendChild(el("div", { class: "hr" }));

  const grid = el("div", { class: "grid" });

  filtered.forEach(item => {
    const key = `item:${item.id}:learned`;
    const learned = Number(state.progress[key] || 0) > 0;

    const titleFR = item.title_fr || item.fr || "Item";
    const titleEN = item.title_en || item.en || "Item";

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardHeader" }, [
        el("div", {}, [
          el("div", { class: "cardTitle", text: titleFR }),
          el("div", { class: "line", text: titleEN })
        ]),
        el("div", { class: "pill", text: learned ? "Learned" : "To learn" })
      ]),
      el("div", { class: "stack" }, [
        bilingualBlock(item.fr || item.title_fr || "", item.en || item.title_en || "", item.tip),
        item.example_fr ? bilingualBlock(item.example_fr, item.example_en || "", item.example_tip || "") : el("div", {}),
        el("div", { class: "actions" }, [
          el("button", { class: "btn primary", text: learned ? "Unmark learned" : "Mark learned", onclick: () => {
            state.progress[key] = learned ? 0 : 1;
            saveProgress();
            render();
            openModule(id);
          }}),
          el("button", { class: "btn", text: "Add +1 review", onclick: () => bumpProgress(`item:${item.id}:review`, 1) })
        ])
      ])
    ]);
    grid.appendChild(card);
  });

  if(filtered.length === 0){
    grid.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No items found" }),
      el("div", { class: "line", text: "Clear search or choose another module." })
    ]));
  }

  area.appendChild(grid);
}

function renderSigns(area){
  setHeader("Road signs", "Learn sign meaning in French and English. Use search for speed.");
  const signs = state.data.signs.filter(matchesSearch);

  const grid = el("div", { class: "grid" });
  signs.forEach(s => {
    const key = `item:${s.id}:learned`;
    const learned = Number(state.progress[key] || 0) > 0;

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardHeader" }, [
        el("div", {}, [
          el("div", { class: "cardTitle", text: s.title_fr }),
          el("div", { class: "line", text: s.title_en })
        ]),
        el("div", { class: "pill", text: s.category })
      ]),
      el("div", { class: "stack" }, [
        bilingualBlock(s.fr, s.en, s.tip),
        el("div", { class: "actions" }, [
          el("button", { class: "btn primary", text: learned ? "Unmark learned" : "Mark learned", onclick: () => {
            state.progress[key] = learned ? 0 : 1;
            saveProgress();
            render();
          }}),
          el("button", { class: "btn", text: "Review +1", onclick: () => bumpProgress(`item:${s.id}:review`, 1) })
        ])
      ])
    ]);
    grid.appendChild(card);
  });

  if(signs.length === 0){
    grid.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No results" }),
      el("div", { class: "line", text: "Try fewer keywords. Example: stop, priorité, interdit, danger." })
    ]));
  }
  area.appendChild(grid);
}

function renderRules(area){
  setHeader("Rules", "Priority, speed, overtaking, parking, lights. FR with EN support.");
  const rules = state.data.rules.filter(matchesSearch);

  const grid = el("div", { class: "grid" });
  rules.forEach(r => {
    const key = `item:${r.id}:learned`;
    const learned = Number(state.progress[key] || 0) > 0;

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardHeader" }, [
        el("div", {}, [
          el("div", { class: "cardTitle", text: r.title_fr }),
          el("div", { class: "line", text: r.title_en })
        ]),
        el("div", { class: "pill", text: r.topic })
      ]),
      el("div", { class: "stack" }, [
        bilingualBlock(r.fr, r.en, r.tip),
        r.example_fr ? bilingualBlock(r.example_fr, r.example_en || "", r.example_tip || "") : el("div", {}),
        el("div", { class: "actions" }, [
          el("button", { class: "btn primary", text: learned ? "Unmark learned" : "Mark learned", onclick: () => {
            state.progress[key] = learned ? 0 : 1;
            saveProgress();
            render();
          }}),
          el("button", { class: "btn", text: "Review +1", onclick: () => bumpProgress(`item:${r.id}:review`, 1) })
        ])
      ])
    ]);
    grid.appendChild(card);
  });

  if(rules.length === 0){
    grid.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No results" }),
      el("div", { class: "line", text: "Try: priorité à droite, dépassement, stationnement, vitesse." })
    ]));
  }

  area.appendChild(grid);
}

function renderVocab(area){
  setHeader("Vocabulary", "High frequency exam words. Learn meaning and usage.");
  const vocab = state.data.vocab.filter(matchesSearch);

  const grid = el("div", { class: "grid" });
  vocab.forEach(v => {
    const key = `item:${v.id}:learned`;
    const learned = Number(state.progress[key] || 0) > 0;

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardHeader" }, [
        el("div", {}, [
          el("div", { class: "cardTitle", text: v.word_fr }),
          el("div", { class: "line", text: v.word_en })
        ]),
        el("div", { class: "pill", text: v.type })
      ]),
      el("div", { class: "stack" }, [
        bilingualBlock(v.fr, v.en, v.tip),
        v.example_fr ? bilingualBlock(v.example_fr, v.example_en || "", v.example_tip || "") : el("div", {}),
        el("div", { class: "actions" }, [
          el("button", { class: "btn primary", text: learned ? "Unmark learned" : "Mark learned", onclick: () => {
            state.progress[key] = learned ? 0 : 1;
            saveProgress();
            render();
          }}),
          el("button", { class: "btn", text: "Review +1", onclick: () => bumpProgress(`item:${v.id}:review`, 1) })
        ])
      ])
    ]);
    grid.appendChild(card);
  });

  if(vocab.length === 0){
    grid.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No results" }),
      el("div", { class: "line", text: "Try: chaussée, dépassement, intersection, prioritaire." })
    ]));
  }

  area.appendChild(grid);
}

function getFlashcardPool(){
  const sourceModule = state.progress["flashcards:sourceModule"];
  if(sourceModule){
    const m = state.data.modules.find(x => x.id === sourceModule);
    if(m){
      const items = [];
      if(m.includes.includes("signs")) items.push(...state.data.signs.filter(s => m.tags.some(t => (s.tags || []).includes(t))));
      if(m.includes.includes("rules")) items.push(...state.data.rules.filter(r => m.tags.some(t => (r.tags || []).includes(t))));
      if(m.includes.includes("vocab")) items.push(...state.data.vocab.filter(v => m.tags.some(t => (v.tags || []).includes(t))));
      return items;
    }
  }
  return [...state.data.signs, ...state.data.rules, ...state.data.vocab];
}

function renderFlashcards(area){
  setHeader("Flashcards", "Short review. Flip card. Track recall.");
  const pool = getFlashcardPool().filter(matchesSearch);

  if(pool.length === 0){
    area.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No flashcards available" }),
      el("div", { class: "line", text: "Clear search or open a module and choose Study with flashcards." })
    ]));
    return;
  }

  const idxKey = "flashcards:index";
  const i = Number(state.progress[idxKey] || 0) % pool.length;
  const item = pool[i];
  const flipKey = "flashcards:flipped";
  const flipped = state.progress[flipKey] === 1;

  const titleFR = item.title_fr || item.word_fr || item.fr || "Card";
  const titleEN = item.title_en || item.word_en || item.en || "Card";

  const frontFR = titleFR;
  const frontEN = titleEN;
  const backFR = item.fr || item.example_fr || titleFR;
  const backEN = item.en || item.example_en || titleEN;

  const card = el("div", { class: "card" }, [
    el("div", { class: "cardHeader" }, [
      el("div", {}, [
        el("div", { class: "cardTitle", text: "Card " + (i + 1) + " / " + pool.length }),
        el("div", { class: "line", text: "Source: " + (state.progress["flashcards:sourceModule"] || "all") })
      ]),
      el("div", { class: "pill", text: flipped ? "Back" : "Front" })
    ]),
    el("div", { class: "stack" }, [
      flipped
        ? bilingualBlock(backFR, backEN, item.tip)
        : bilingualBlock(frontFR, frontEN, "Flip to read the explanation"),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", text: flipped ? "Show front" : "Flip", onclick: () => {
          state.progress[flipKey] = flipped ? 0 : 1;
          saveProgress();
          render();
        }}),
        el("button", { class: "btn", text: "Next", onclick: () => {
          state.progress[idxKey] = (i + 1) % pool.length;
          state.progress[flipKey] = 0;
          bumpProgress(`item:${item.id}:review`, 1);
          saveProgress();
          render();
        }}),
        el("button", { class: "btn", text: "I knew this", onclick: () => {
          bumpProgress(`item:${item.id}:learned`, 1);
        }}),
        el("button", { class: "btn", text: "Reset source", onclick: () => {
          delete state.progress["flashcards:sourceModule"];
          saveProgress();
          render();
        }})
      ])
    ])
  ]);

  area.appendChild(card);
}

function getQuizPool(){
  const sourceModule = state.progress["quiz:sourceModule"];
  let q = state.data.questions;

  if(sourceModule){
    const m = state.data.modules.find(x => x.id === sourceModule);
    if(m){
      q = q.filter(qq => (qq.tags || []).some(t => m.tags.includes(t)));
    }
  }
  if(state.search){
    const s = normalize(state.search);
    q = q.filter(qq => normalize(qq.q_fr + " " + qq.q_en + " " + (qq.tags || []).join(" ")).includes(s));
  }
  return q;
}

function renderQuiz(area){
  setHeader("Quiz", "Practice exam style questions. Read FR. Confirm with EN.");
  const pool = getQuizPool();

  if(pool.length === 0){
    area.appendChild(el("div", { class: "card" }, [
      el("div", { class: "cardTitle", text: "No questions available" }),
      el("div", { class: "line", text: "Clear search or open a module and choose Practice quiz." })
    ]));
    return;
  }

  const idxKey = "quiz:index";
  const i = Number(state.progress[idxKey] || 0) % pool.length;
  const q = pool[i];

  const answeredKey = `quiz:${q.id}:answered`;
  const chosenKey = `quiz:${q.id}:chosen`;
  const answered = state.progress[answeredKey] === 1;
  const chosen = Number(state.progress[chosenKey] || -1);

  const card = el("div", { class: "card" }, [
    el("div", { class: "cardHeader" }, [
      el("div", {}, [
        el("div", { class: "cardTitle", text: "Question " + (i + 1) + " / " + pool.length }),
        el("div", { class: "line", text: "Topic tags: " + (q.tags || []).join(", ") })
      ]),
      el("div", { class: "pill", text: answered ? "Answered" : "Open" })
    ]),
    el("div", { class: "stack" }, [
      bilingualBlock(q.q_fr, q.q_en, q.tip),
      el("div", { class: "hr" })
    ])
  ]);

  q.options.forEach((opt, idx) => {
    const isCorrect = idx === q.correct;
    const isChosen = idx === chosen;

    const cls =
      "quizOption" +
      (answered && isCorrect ? " correct" : "") +
      (answered && isChosen && !isCorrect ? " wrong" : "");

    const option = el("div", { class: cls, onclick: () => {
      if(answered) return;
      state.progress[chosenKey] = idx;
      state.progress[answeredKey] = 1;
      saveProgress();
      if(isCorrect){
        bumpProgress("quiz:correct", 1);
      } else {
        bumpProgress("quiz:wrong", 1);
      }
      render();
    }}, [
      el("div", { class: "pill", text: String.fromCharCode(65 + idx) }),
      el("div", {}, [
        bilingualBlock(opt.fr, opt.en, "")
      ])
    ]);

    card.appendChild(option);
  });

  if(answered){
    card.appendChild(el("div", { class: "hr" }));
    card.appendChild(bilingualBlock(q.explain_fr, q.explain_en, "Focus on the rule. Not on guessing."));
  }

  card.appendChild(el("div", { class: "actions" }, [
    el("button", { class: "btn", text: "Next question", onclick: () => {
      state.progress[idxKey] = (i + 1) % pool.length;
      saveProgress();
      render();
    }}),
    el("button", { class: "btn", text: "Reset answer", onclick: () => {
      state.progress[answeredKey] = 0;
      state.progress[chosenKey] = -1;
      saveProgress();
      render();
    }}),
    el("button", { class: "btn", text: "Reset source", onclick: () => {
      delete state.progress["quiz:sourceModule"];
      saveProgress();
      render();
    }})
  ]));

  area.appendChild(card);
}

function renderProgress(area){
  setHeader("Progress", "Track learning and quiz performance.");
  const learnedCount = Object.keys(state.progress).filter(k => k.endsWith(":learned") && Number(state.progress[k] || 0) > 0).length;
  const reviewCount = Object.keys(state.progress).filter(k => k.includes(":review")).reduce((acc, k) => acc + Number(state.progress[k] || 0), 0);
  const correct = Number(state.progress["quiz:correct"] || 0);
  const wrong = Number(state.progress["quiz:wrong"] || 0);
  const totalQuiz = correct + wrong;
  const accuracy = totalQuiz === 0 ? 0 : Math.round((correct / totalQuiz) * 100);

  const kpis = el("div", { class: "kpiRow" }, [
    el("div", { class: "kpi" }, [ el("div", { class: "kpiTitle", text: "Items marked learned" }), el("div", { class: "kpiValue", text: String(learnedCount) }) ]),
    el("div", { class: "kpi" }, [ el("div", { class: "kpiTitle", text: "Total review clicks" }), el("div", { class: "kpiValue", text: String(reviewCount) }) ]),
    el("div", { class: "kpi" }, [ el("div", { class: "kpiTitle", text: "Quiz answered" }), el("div", { class: "kpiValue", text: String(totalQuiz) }) ]),
    el("div", { class: "kpi" }, [ el("div", { class: "kpiTitle", text: "Quiz accuracy" }), el("div", { class: "kpiValue", text: String(accuracy) + "%" }) ])
  ]);

  const tools = el("div", { class: "card" }, [
    el("div", { class: "cardTitle", text: "Actions" }),
    el("div", { class: "line", text: "Progress saves on this device only." }),
    el("div", { class: "actions" }, [
      el("button", { class: "btn", text: "Export progress JSON", onclick: exportProgress }),
      el("button", { class: "btn", text: "Import progress JSON", onclick: importProgress }),
      el("button", { class: "btn", text: "Reset all progress", onclick: resetProgress })
    ])
  ]);

  area.appendChild(kpis);
  area.appendChild(el("div", { class: "hr" }));
  area.appendChild(tools);

  const summary = el("div", { class: "card" }, [
    el("div", { class: "cardTitle", text: "What to do next" }),
    el("div", { class: "line", text: "Study a module. Mark items learned. Review flashcards. Practice quiz daily." }),
    el("div", { class: "line", text: "If French is hard, enable English first and read EN then FR." })
  ]);
  area.appendChild(el("div", { class: "hr" }));
  area.appendChild(summary);
}

function exportProgress(){
  const data = JSON.stringify(state.progress, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "code-route-progress.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files[0];
    if(!file) return;
    const text = await file.text();
    try{
      const obj = JSON.parse(text);
      state.progress = obj || {};
      saveProgress();
      render();
    } catch(e){
      alert("Invalid JSON file.");
    }
  };
  input.click();
}

function resetProgress(){
  if(!confirm("Reset all progress on this device?")) return;
  state.progress = {};
  saveProgress();
  render();
}

function wireUI(){
  document.getElementById("modeBtn").addEventListener("click", () => {
    setTheme(state.theme === "light" ? "dark" : "light");
    render();
  });

  document.getElementById("langBtn").addEventListener("click", () => {
    setLangMode();
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    render();
  });

  document.getElementById("showEnglishFirst").checked = state.showEnglishFirst;
  document.getElementById("showEnglishFirst").addEventListener("change", (e) => setEnglishFirstSetting(e.target.checked));

  document.getElementById("showHints").checked = state.showHints;
  document.getElementById("showHints").addEventListener("change", (e) => setHintsSetting(e.target.checked));

  document.querySelectorAll(".navItem").forEach(btn => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      render();
    });
  });
}

wireUI();
loadAll();
