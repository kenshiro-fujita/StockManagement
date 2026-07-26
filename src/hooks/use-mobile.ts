/**
 * CSS の md ブレークポイントと同じ条件を購読するレスポンシブ判定フックです。
 *
 * useSyncExternalStore を使うことで、Effect 内の同期的な state 更新や
 * リスナー解除漏れを避けつつ、matchMedia を単一の外部ストアとして扱います。
 */
import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToMobileQuery(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);

  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerMobileSnapshot() {
  // SSR はデスクトップとして固定し、クライアント側で安全に再評価します。
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    getServerMobileSnapshot
  );
}
