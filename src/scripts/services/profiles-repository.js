import { getBaseUrl } from "../domain/url-utils.js";

export function migrateLegacyProfiles(callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    let migrated = false;
    Object.keys(stored).forEach((legacyUrl) => {
      if (!Array.isArray(stored[legacyUrl])) return;
      const baseUrl = getBaseUrl(legacyUrl) || legacyUrl;
      const application = stored[baseUrl] && !Array.isArray(stored[baseUrl])
        ? stored[baseUrl]
        : { pages: [] };
      if (!Array.isArray(application.pages)) application.pages = [];
      const legacyId = `${legacyUrl}::legacy`;
      if (!application.pages.some((profile) => profile.id === legacyId)) {
        application.pages.push({
          id: legacyId,
          name: "Mapeamento salvo",
          pageUrl: legacyUrl,
          fields: stored[legacyUrl]
        });
      }
      stored[baseUrl] = application;
      if (legacyUrl !== baseUrl) delete stored[legacyUrl];
      migrated = true;
    });
    if (!migrated) {
      callback();
      return;
    }
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, callback);
  });
}

export function readProfiles(baseUrl, callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    const profiles = stored[baseUrl];
    callback(profiles && Array.isArray(profiles.pages) ? profiles.pages : []);
  });
}

export function writeProfiles(baseUrl, profiles, callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    stored[baseUrl] = { pages: profiles };
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, callback);
  });
}
