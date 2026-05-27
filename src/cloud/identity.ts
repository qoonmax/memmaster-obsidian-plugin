const USER_KEY_REGEX = /^mmr_[A-Za-z0-9_-]{43,}$/;

function isValidUserKey(userKey: string): boolean {
	return USER_KEY_REGEX.test(userKey.trim());
}

export { USER_KEY_REGEX, isValidUserKey };
