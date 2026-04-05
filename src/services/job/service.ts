export function normalizeJobUrl(rawUrl?: string | null): string {
    if (!rawUrl) return '';

    // Step 1: Default to HTTPS if protocol is missing
    const urlPattern = /^(https?):\/\//i;
    let url = rawUrl.replace(/^\s+|\s+$/g, '').replace(/['"\[\]()\{\}]/g, '');
    if (!urlPattern.test(url)) {
        url = 'https://' + url;
    }

    // Step 2: Strip trailing punctuation
    url = url.replace(/[\s\.,;!?]+$/g, '');

    // Step 3: Extract URLs from markdown/text
    const markdownPattern = /.*?\((.*?)\)/;
    const match = url.match(markdownPattern);
    if (match) {
        url = match[1];
    }

    // Step 4: Unwrap redirector query params
    const redirectParams = ['url', 'u', 'redirect', 'redirect_url', 'redirectUri', 'target', 'dest', 'destination', 'continue', 'next', 'r', 'link', 'q'];
    for (let i = 0; i < 3; i++) {
        const urlObj = new URL(url);
        redirectParams.forEach(param => {
            if (urlObj.searchParams.has(param)) {
                url = urlObj.searchParams.get(param) || url;
                urlObj.searchParams.delete(param);
            }
        });
    }

    // Step 5: Remove common tracking parameters
    const trackingParams = /([&?](utm_[^=]*|gclid|fbclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|igshid|si|spm)=[^&]*)/g;
    url = url.replace(trackingParams, '');

    // Step 6: Drop URL hash fragments
    const cleanUrl = url.split('#')[0];

    // Step 7: Validate host
    const finalUrl = new URL(cleanUrl);
    if (!finalUrl.hostname || finalUrl.hostname.includes('placeholder')) {
        return '';
    }

    return finalUrl.toString();
}