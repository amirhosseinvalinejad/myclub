const I18N_KEYS = [
  "langLabel", "convertLabel", "titleHome", "titleLogin", "titleCreate", "titleClub",
  "titleForgot", "titleReset", "forgotPassword", "sendReset", "setNewPassword",
  "heroBuild", "heroExpend", "heroWin", "login", "account", "email", "password",
  "createPassword", "confirmPassword", "createAccount", "backHome", "registration",
  "notRobot", "captcha", "completeReg", "tagline", "clubName", "clubPlaceholder",
  "foundClub", "funds", "skill", "fans", "record", "train", "recruit", "play", "prizes",
  "noPrizes", "loading", "failed", "passwordsMismatch", "confirmRobot", "clubOnPitch",
  "prizePrefix", "logTrain", "logRecruit", "logWin", "logLoss", "logDraw",
  "prizeFirst", "prizeLocal", "prizeCity", "prizeLeague", "prizeCrowd", "prizeTrain", "prizeChamp",
  "errPleaseLogin", "errEmail", "errPasswordLen", "errRobot", "errEmailTaken", "errLoginBad",
  "errClubName", "errFoundFirst", "errFundsTrain", "errFundsRecruit", "errFundsMatch",
  "errCaptchaExpired", "errCaptchaFail", "errRegFailed"
];

const SERVER_ERROR_KEYS = {
  "Please log in.": "errPleaseLogin",
  "Enter a valid email address.": "errEmail",
  "Password must be at least 6 characters.": "errPasswordLen",
  "Password must be at least 8 characters and include a letter, a number, and a special character.": "errPasswordLen",
  "Confirm you are not a robot.": "errRobot",
  "That email is already registered.": "errEmailTaken",
  "Incorrect email or password.": "errLoginBad",
  "Club name is required.": "errClubName",
  "Found a club first.": "errFoundFirst",
  "Not enough funds to train.": "errFundsTrain",
  "Not enough funds to recruit.": "errFundsRecruit",
  "Not enough funds to travel to a match.": "errFundsMatch",
  "Captcha expired. Try again.": "errCaptchaExpired",
  "Captcha failed. Confirm you are not a robot.": "errCaptchaFail",
  "Registration failed.": "errRegFailed",
};

function translateServerError(message) {
  const key = SERVER_ERROR_KEYS[message];
  return key ? t(key) : message;
}

function t(key, vars) {
  const lang = (document.documentElement.lang || "en").split("-")[0];
  const idx = I18N_KEYS.indexOf(key);
  const row = I18N_PACKS[lang] || I18N_PACKS.en;
  let value = (idx >= 0 && row && row[idx]) || (I18N_PACKS.en && I18N_PACKS.en[idx]) || key;
  if (vars) {
    for (const [name, item] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(item));
    }
  }
  return value;
}

const I18N_PACKS = {};
