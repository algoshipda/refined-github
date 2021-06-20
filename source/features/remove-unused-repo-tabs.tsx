import cache from 'webext-storage-cache';
import select from 'select-dom';
import elementReady from 'element-ready';
import * as pageDetect from 'github-url-detection';

import features from '.';
import fetchDom from '../helpers/fetch-dom';
import getTabCount from '../github-helpers/get-tab-count';
import looseParseInt from '../helpers/loose-parse-int';
import {getWorkflows} from './next-scheduled-github-action';
import abbreviateNumber from '../helpers/abbreviate-number';
import {getProjectsTab} from './remove-projects-tab';
import {buildRepoURL, getRepo} from '../github-helpers';

function tabCannotBeRemoved(tab: HTMLElement | undefined): boolean {
	if (
		!tab || // Tab disabled 🎉
		tab.matches('.selected') // User is on tab 👀
	) {
		return true;
	}

	return false;
}

function setTabCounter(tab: HTMLElement, count: number): void {
	const tabCounter = select('.Counter', tab)!;
	tabCounter.textContent = abbreviateNumber(count);
	tabCounter.title = count > 999 ? String(count) : '';
}

const getWikiPageCount = cache.function(async (): Promise<number> => {
	const wikiPages = await fetchDom(buildRepoURL('wiki'), '#wiki-pages-box .Counter');
	if (!wikiPages) {
		return 0;
	}

	return looseParseInt(wikiPages);
}, {
	maxAge: {hours: 1},
	staleWhileRevalidate: {days: 5},
	cacheKey: () => __filebasename + 'wiki:' + getRepo()!.nameWithOwner
});

async function initWiki(): Promise<void | false> {
	const wikiTab = await elementReady('[data-hotkey="g w"]');
	if (tabCannotBeRemoved(wikiTab)) {
		return false;
	}

	const wikiPageCount = await getWikiPageCount();
	if (wikiPageCount > 0) {
		setTabCounter(wikiTab!, wikiPageCount);
	} else {
		wikiTab!.remove();
	}
}

async function initActions(): Promise<void | false> {
	const actionsTab = await elementReady('[data-hotkey="g a"]');
	if (tabCannotBeRemoved(actionsTab)) {
		return false;
	}

	const actionsCount = (await getWorkflows()).length;
	if (actionsCount > 0) {
		setTabCounter(actionsTab!, actionsCount);
	} else {
		actionsTab!.remove();
	}
}

async function initProjects(): Promise<void | false> {
	const projectsTab = await getProjectsTab();
	if (tabCannotBeRemoved(projectsTab) || await getTabCount(projectsTab!) > 0) {
		return false;
	}

	projectsTab!.remove();
}

void features.add(__filebasename, {
	include: [
		pageDetect.isRepo,
		pageDetect.isUserProfile,
		pageDetect.isOrganizationProfile
	],
	exclude: [
		// Repo/Organization owners should see the tab. If they don't need it, they should disable Projects altogether
		pageDetect.canUserEditRepo,
		pageDetect.canUserEditOrganization
	],
	awaitDomReady: false,
	init: initProjects
}, {
	include: [
		pageDetect.isRepo
	],
	awaitDomReady: false,
	init: initActions
}, {
	include: [
		pageDetect.isRepo
	],
	awaitDomReady: false,
	init: initWiki
});