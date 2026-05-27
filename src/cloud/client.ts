import { Notice, requestUrl } from 'obsidian';
import type MemMasterPlugin from '../main';
import { isValidUserKey } from './identity';

const MEMMASTER_API_BASE_URL = 'https://backend.memmaster.com';

interface UserKeyResponse {
	userKey: string;
	createdAt: string;
}

interface UserStatusResponse {
	status: 'ok';
	createdAt: string;
}

type CloudUserStatus =
	| { state: 'connected'; user: UserStatusResponse }
	| { state: 'not_found' }
	| { state: 'bad_request' }
	| { state: 'unavailable' };

function isValidDateTime(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseUserKeyResponse(payload: unknown): UserKeyResponse | null {
	const data = payload as Partial<UserKeyResponse> | null;

	if (!data || typeof data.userKey !== 'string' || !isValidUserKey(data.userKey) || !isValidDateTime(data.createdAt)) {
		return null;
	}

	return {
		userKey: data.userKey,
		createdAt: data.createdAt,
	};
}

function parseUserStatusResponse(payload: unknown): UserStatusResponse | null {
	const data = payload as Partial<UserStatusResponse> | null;

	if (!data || data.status !== 'ok' || !isValidDateTime(data.createdAt)) {
		return null;
	}

	return {
		status: data.status,
		createdAt: data.createdAt,
	};
}

async function createCloudUser(plugin: MemMasterPlugin): Promise<UserKeyResponse | null> {
	try {
		const response = await requestUrl({
			url: `${MEMMASTER_API_BASE_URL}/v1/users`,
			method: 'POST',
			throw: false,
		});

		if (response.status === 201) {
			const user = parseUserKeyResponse(response.json);

			if (user) {
				return user;
			}
		}

		new Notice(plugin.i18n.t(response.status >= 500
			? 'notices.cloudUnavailable'
			: 'notices.connectionCreationFailed'));
		return null;
	} catch {
		new Notice(plugin.i18n.t('notices.cloudNetworkError'));
		return null;
	}
}

async function checkCloudUserStatus(userKey: string): Promise<CloudUserStatus> {
	try {
		const response = await requestUrl({
			url: `${MEMMASTER_API_BASE_URL}/v1/users/status`,
			method: 'POST',
			contentType: 'application/json',
			body: JSON.stringify({ userKey }),
			throw: false,
		});

		if (response.status === 200) {
			const user = parseUserStatusResponse(response.json);

			return user
				? { state: 'connected', user }
				: { state: 'unavailable' };
		}

		if (response.status === 404) {
			return { state: 'not_found' };
		}

		if (response.status === 400) {
			return { state: 'bad_request' };
		}

		return { state: 'unavailable' };
	} catch {
		return { state: 'unavailable' };
	}
}

export type { CloudUserStatus, UserKeyResponse, UserStatusResponse };
export { checkCloudUserStatus, createCloudUser };
