const fs = require("fs");
const KEYS_LEN = 66;
const packs = {};

function add(code, arr) {
  if (arr.length !== KEYS_LEN) {
    throw new Error(`${code} has ${arr.length}, expected ${KEYS_LEN}`);
  }
  packs[code] = arr;
}

add("en", [
  "Language","Convert","Build your club","Login","Create account","Your club",
  "Build your club","Expend it","Win prizes","Login","Account","Email address","Password",
  "Create a password","Confirm password","Create account","Back to home","Registration",
  "I'm not a robot","captcha","Complete registration","Build your club, grow it, win prizes",
  "Club name","Name your club","Found club","Funds","Skill","Fans","Record","Train squad",
  "Recruit fans","Play match","Prizes","No prizes yet. Win a match to start the cabinet.",
  "Loading…","Request failed.","Passwords do not match.","Confirm you are not a robot.",
  "{name} is on the pitch.","Prize: {titles}.","Squad trained. Skill is now {skill}.",
  "New supporters joined. Fans: {fans}.","Match {n}: win. The ball hit the net. +$55.",
  "Match {n}: loss. Time to train harder.","Match {n}: draw. +$20.",
  "First Victory","Local Cup","City Shield","League Trophy","Crowd Roar","Training Ground Badge","Champions Cup",
  "Please log in.","Enter a valid email address.","Password must be at least 6 characters.",
  "Confirm you are not a robot.","That email is already registered.","Incorrect email or password.",
  "Club name is required.","Found a club first.","Not enough funds to train.",
  "Not enough funds to recruit.","Not enough funds to travel to a match.",
  "Captcha expired. Try again.","Captcha failed. Confirm you are not a robot.","Registration failed."
]);

module.exports = { add, packs, KEYS_LEN };
