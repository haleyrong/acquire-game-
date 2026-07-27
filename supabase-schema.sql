CREATE TABLE IF NOT EXISTS games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'waiting',
  mode            TEXT DEFAULT 'classic',
  config          JSONB DEFAULT '{}',
  current_phase   TEXT DEFAULT 'place_tile',
  current_player_index INT DEFAULT 0,
  stocks_bought_this_turn INT DEFAULT 0,
  pending_hotel_founding JSONB,
  pending_acquirer_choice JSONB,
  active_mergers  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id       UUID,
  display_name  TEXT NOT NULL,
  cash          INT DEFAULT 6000,
  turn_order    INT NOT NULL,
  is_connected  BOOLEAN DEFAULT false,
  stocks        JSONB DEFAULT '[]',
  hand_tile_ids JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    UUID REFERENCES games(id) ON DELETE CASCADE,
  row_num    INT NOT NULL,
  col_num    INT NOT NULL,
  label      TEXT NOT NULL,
  placed     BOOLEAN DEFAULT false,
  hotel_id   UUID,
  placed_by  UUID,
  UNIQUE(game_id, row_num, col_num)
);

CREATE TABLE IF NOT EXISTS hotels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID REFERENCES games(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  tier             TEXT NOT NULL,
  color            TEXT NOT NULL,
  size             INT DEFAULT 0,
  is_safe          BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT false,
  remaining_stocks INT DEFAULT 25,
  stock_price      INT DEFAULT 200
);

CREATE TABLE IF NOT EXISTS game_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id    UUID,
  action       TEXT NOT NULL,
  description  TEXT NOT NULL,
  payload      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_tiles_game ON tiles(game_id);
CREATE INDEX IF NOT EXISTS idx_hotels_game ON hotels(game_id);
CREATE INDEX IF NOT EXISTS idx_log_game ON game_log(game_id);
CREATE INDEX IF NOT EXISTS idx_log_created ON game_log(created_at);
CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_tiles" ON tiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_hotels" ON hotels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_log" ON game_log FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE game_log;
