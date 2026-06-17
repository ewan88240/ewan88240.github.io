const Config = {
  Owner: "",
  Repo: "",
  Folder: "entries",
  BootDelay: 1400
};

const State = {
  Entries: [],
  Selected: -1,
  Order: "newest"
};

const MonthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

let Booted = false;

function DetectTarget() {
  const Host = window.location.hostname;
  const Segments = window.location.pathname.split("/").filter(function (Part) {
    return Part && !Part.includes(".");
  });
  let Owner = Config.Owner;
  let Repo = Config.Repo;
  if (!Owner && Host.endsWith("github.io")) {
    Owner = Host.split(".")[0];
  }
  if (!Repo) {
    if (Segments.length > 0 && Host.endsWith("github.io")) {
      Repo = Segments[0];
    } else if (Owner) {
      Repo = Owner + ".github.io";
    }
  }
  return { Owner: Owner, Repo: Repo };
}

function ParseEntry(Item) {
  if (!Item || Item.type !== "file") {
    return null;
  }
  const Match = Item.name.match(/^(\d{2})(\d{2})(\d{4})(\d+)\.txt$/i);
  if (!Match) {
    return null;
  }
  const Month = parseInt(Match[1], 10);
  const Day = parseInt(Match[2], 10);
  const Year = parseInt(Match[3], 10);
  const Part = parseInt(Match[4], 10);
  const Stamp = new Date(Year, Month - 1, Day).getTime();
  return {
    Name: Item.name,
    Url: Item.download_url,
    Month: Month,
    Day: Day,
    Year: Year,
    Part: Part,
    Stamp: Stamp
  };
}

async function LoadEntries() {
  const Target = DetectTarget();
  if (!Target.Owner || !Target.Repo) {
    throw new Error("?CONFIG NOT SET ERROR");
  }
  const ApiUrl = "https://api.github.com/repos/" + Target.Owner + "/" + Target.Repo + "/contents/" + Config.Folder;
  const Response = await fetch(ApiUrl, { headers: { Accept: "application/vnd.github.v3+json" } });
  if (!Response.ok) {
    throw new Error("?DEVICE NOT PRESENT ERROR  (" + Response.status + ")");
  }
  const Items = await Response.json();
  const Parsed = [];
  for (let I = 0; I < Items.length; I++) {
    const Entry = ParseEntry(Items[I]);
    if (Entry) {
      Parsed.push(Entry);
    }
  }
  return Parsed;
}

function SortEntries() {
  State.Entries.sort(function (A, B) {
    if (A.Stamp !== B.Stamp) {
      return State.Order === "newest" ? B.Stamp - A.Stamp : A.Stamp - B.Stamp;
    }
    return State.Order === "newest" ? B.Part - A.Part : A.Part - B.Part;
  });
}

function FormatLabel(Entry) {
  const Dd = String(Entry.Day).padStart(2, "0");
  return Dd + " " + MonthNames[Entry.Month - 1] + " " + Entry.Year + "  PART " + Entry.Part;
}

function RenderList() {
  const ListEl = document.getElementById("EntryList");
  ListEl.innerHTML = "";
  if (State.Entries.length === 0) {
    const Empty = document.createElement("li");
    Empty.className = "Empty";
    Empty.textContent = "NO ENTRIES.";
    ListEl.appendChild(Empty);
    return;
  }
  for (let I = 0; I < State.Entries.length; I++) {
    const Entry = State.Entries[I];
    const Item = document.createElement("li");
    Item.className = "EntryItem" + (I === State.Selected ? " IsSelected" : "");
    Item.textContent = FormatLabel(Entry);
    Item.setAttribute("data-index", String(I));
    Item.addEventListener("click", function () {
      SelectEntry(parseInt(this.getAttribute("data-index"), 10));
    });
    ListEl.appendChild(Item);
  }
}

function SelectEntry(Index) {
  if (Index < 0 || Index >= State.Entries.length) {
    return;
  }
  State.Selected = Index;
  RenderList();
  const Active = document.querySelector(".EntryItem.IsSelected");
  if (Active) {
    Active.scrollIntoView({ block: "nearest" });
  }
  OpenEntry(State.Entries[Index]);
}

async function OpenEntry(Entry) {
  const Reader = document.getElementById("Reader");
  const TitleEl = document.getElementById("ReaderTitle");
  TitleEl.textContent = FormatLabel(Entry);
  Reader.textContent = "LOADING...";
  try {
    const Response = await fetch(Entry.Url, { cache: "no-store" });
    if (!Response.ok) {
      throw new Error();
    }
    const Text = await Response.text();
    Reader.textContent = Text.length ? Text : "(EMPTY ENTRY)";
  } catch (Err) {
    Reader.textContent = "?FILE NOT FOUND ERROR";
  }
}

function UpdateOrderButton() {
  const Button = document.getElementById("OrderButton");
  Button.textContent = State.Order === "newest" ? "SORT: NEWEST" : "SORT: OLDEST";
}

function ToggleOrder() {
  State.Order = State.Order === "newest" ? "oldest" : "newest";
  UpdateOrderButton();
  const Current = State.Selected >= 0 ? State.Entries[State.Selected] : null;
  SortEntries();
  State.Selected = Current ? State.Entries.indexOf(Current) : -1;
  RenderList();
  const Active = document.querySelector(".EntryItem.IsSelected");
  if (Active) {
    Active.scrollIntoView({ block: "nearest" });
  }
}

function HandleKeys(Event) {
  if (Event.target && Event.target.tagName === "BUTTON" && Event.key === "Enter") {
    return;
  }
  const Key = Event.key;
  if (Key === "s" || Key === "S") {
    Event.preventDefault();
    ToggleOrder();
    return;
  }
  if (State.Entries.length === 0) {
    return;
  }
  if (Key === "ArrowDown" || Key === "j") {
    Event.preventDefault();
    SelectEntry(Math.min(State.Selected + 1, State.Entries.length - 1));
  } else if (Key === "ArrowUp" || Key === "k") {
    Event.preventDefault();
    SelectEntry(Math.max(State.Selected - 1, 0));
  } else if (Key === "Home") {
    Event.preventDefault();
    SelectEntry(0);
  } else if (Key === "End") {
    Event.preventDefault();
    SelectEntry(State.Entries.length - 1);
  } else if (Key === "Enter") {
    Event.preventDefault();
    if (State.Selected >= 0) {
      OpenEntry(State.Entries[State.Selected]);
    }
  }
}

async function Init() {
  document.getElementById("OrderButton").addEventListener("click", ToggleOrder);
  document.addEventListener("keydown", HandleKeys);
  UpdateOrderButton();
  const Reader = document.getElementById("Reader");
  try {
    State.Entries = await LoadEntries();
    SortEntries();
    RenderList();
    if (State.Entries.length > 0) {
      SelectEntry(0);
    } else {
      Reader.textContent = "NO ENTRIES FOUND.\n\nADD .TXT FILES TO THE /" + Config.Folder + " FOLDER\nNAMED LIKE 061320261.TXT\n(MONTH DAY YEAR PART)";
    }
  } catch (Err) {
    Reader.textContent = String(Err.message || Err) + "\n\nADD FILES TO /" + Config.Folder + " OR SET OWNER/REPO IN diary.js";
  }
}

function StartApp() {
  document.getElementById("Boot").classList.add("Hidden");
  document.getElementById("App").classList.remove("Hidden");
  Init();
}

function FinishBoot() {
  if (Booted) {
    return;
  }
  Booted = true;
  StartApp();
}

window.addEventListener("load", function () {
  setTimeout(FinishBoot, Config.BootDelay);
  document.getElementById("Boot").addEventListener("click", FinishBoot);
  document.addEventListener("keydown", function () {
    FinishBoot();
  }, { once: true });
});
