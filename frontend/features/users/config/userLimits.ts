// يجب أن تطابق backend/app/modules/users/constants.py و app/core/passwords.py
export const MAX_USERNAME_LEN = 50;
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

/** طابقها مع MIN_PASSWORD_LEN / MAX_PASSWORD_LEN في app/core/passwords.py */
export const MIN_PASSWORD_LEN = 6;
export const MAX_PASSWORD_LEN = 128;

export const COMMON_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "654321",
  "123123",
  "112233",
  "121212",
  "qwerty",
  "abc123",
  "abcdef",
  "admin123",
  "password",
  "password1",
  "password123",
  "passw0rd123",
  "1234567890",
  "12345678910",
  "0123456789",
  "123456789a",
  "qwertyuiop",
  "qwerty12345",
  "admin12345",
  "administrator",
  "welcome123",
  "letmein123",
  "iloveyou123",
  "abcdefghij",
  "1q2w3e4r5t",
  "11111111111",
  "0000000000",
  "dealzora123",
]);
