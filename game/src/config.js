// All tuning constants for MIDNIGHT AT THE MERAH MUSEUM.
// Single source of truth: every number the PLAN fixes lives here.
export const CONFIG = {
  CANVAS_W: 1280,
  CANVAS_H: 720,
  HUD_H: 56,
  PLAY_BOTTOM: 696, // bottom of the play area; below is the street strip
  TILE: 40,

  PLAYER_R: 14,
  GUARD_R: 14,
  PLAYER_SPEED: 110, // px/s walking
  SNEAK_SPEED: 55, // px/s sneaking (Shift)
  GUARD_PATROL_SPEED: 55,
  GUARD_SUSPICIOUS_SPEED: 80,
  GUARD_CHASE_SPEED: 135,

  CONE_ANGLE_DEG: 70, // full cone angle
  CONE_RANGE: 220,
  SNEAK_RANGE: 150, // effective cone range while sneaking
  CONE_HALF_DEG: 35,

  SUSPICION_UP: 40, // per second while seen
  SUSPICION_DOWN: 25, // per second while unseen (not CHASE)
  SUSPICION_CLOSE_DIST: 80, // seen closer than this -> suspicion jumps to 60
  SUSPICION_CLOSE_VALUE: 60,
  SUSPICION_SUSPICIOUS: 30,
  SUSPICION_CHASE: 60,
  CHASE_LOSE_TIME: 3, // seconds unseen in CHASE -> SEARCH
  SEARCH_TIME: 4, // seconds rotating at last-seen point -> PATROL
  SPOTTED_GRACE: 0.8, // seconds after entering CHASE during which a guard cannot catch
  CATCH_DIST: 26, // centre-to-centre distance that counts as caught

  CAMERA_ALARM_RATE: 12, // per second while a camera sees Sari
  ALARM_PATROL_RATE: 4, // per second while a PATROL guard sees Sari
  ALARM_SUSPICIOUS_RATE: 8,
  ALARM_CHASE_RATE: 20,
  ALARM_DECAY: 6, // per second while nothing sees Sari
  ALARM_HUNT_ON: 60,
  ALARM_HUNT_OFF: 50, // hysteresis: HUNT releases below this
  ALARM_SUSPICIOUS_LABEL: 30,
  CAMERA_ALERT_TIME: 2, // seconds of continuous camera sighting -> guard alerted

  EMP_COUNT: 2,
  EMP_DURATION: 8, // seconds all cameras stay offline
  EMP_ALARM_COST: 12,
  EMP_REONLINE_ALARM: 5, // once, when cameras come back online
  SMOKE_COUNT: 3,
  SMOKE_RADIUS: 90,
  SMOKE_DURATION: 5,
  SMOKE_ALARM_COST: 5,
  SMOKE_SLOW: 0.7, // Sari moves at 70% speed inside smoke
  COIN_COUNT: 3,
  COIN_MAX_THROW: 200, // clicks further away clamp to this distance
  COIN_LURE_RADIUS: 180,
  COIN_LURE_TIME: 4,

  KOMET_VALUE: 5000,
  KOMET_GRAB_TIME: 1.5, // seconds holding E at the plinth
  KOMET_ALARM_COST: 25,
  PAINTING_VALUE: 800,
  PAINTING_GRAB_TIME: 0.5,
  MASK_VALUE: 600,
  MASK_GRAB_TIME: 0.5,
  COIN_VALUE: 150,
  COIN_SPEED_PENALTY: 0.03, // -3% speed per coin carried

  GETAWAY_X: 80,
  GETAWAY_Y: 640,
  GETAWAY_RADIUS: 40,
  SPAWN_X: 80,
  SPAWN_Y: 640,

  MAX_DT: 0.05, // frame-time clamp so guards never jump through walls
};
