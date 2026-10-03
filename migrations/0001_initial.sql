CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  transmission TEXT,
  clue TEXT,
  link TEXT,
  intercept_radius_m INTEGER NOT NULL DEFAULT 140,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intercepts (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  alias TEXT,
  note TEXT,
  public INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 1,
  photo_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(signal_id) REFERENCES signals(id)
);

CREATE INDEX IF NOT EXISTS idx_intercepts_signal_time ON intercepts(signal_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intercepts_public_time ON intercepts(public,created_at DESC);

INSERT OR IGNORE INTO signals
  (id,code,name,region,lat,lng,type,status,transmission,clue,link,intercept_radius_m,active)
VALUES
  ('hpr-001','HPR-001','Newburgh Pointe','HINES PARK // NEWBURGH',42.36733,-83.42335,'SONIC ARTIFACT','ACTIVE','Hines Park Relay 001','Follow the waterline. Let the path choose the pace. The relay sharpens when the lake comes into view.','https://ditto.fm/hines-park-relay',140,1),
  ('mrr-001','MRR-001','Helms Haven','MIDDLE ROUGE // HELMS',42.3402,-83.2638,'FIELD TRANSMISSION','ACTIVE','Middle Rouge Relay','Stay with the Rouge. Traffic should become background radiation. Find the point where the green wins.','',140,1);
