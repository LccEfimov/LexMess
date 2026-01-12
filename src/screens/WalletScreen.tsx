import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';

/**
 * QR is optional. Some Android builds crash if the native module isn't linked.
 * We resolve it dynamically and fallback to a text-only modal.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let QRCodeComponent: any | null | undefined = undefined;
function getQRCodeComponent(): any | null {
  if (QRCodeComponent !== undefined) return QRCodeComponent;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-qrcode-svg');
    QRCodeComponent = mod?.default || mod;
  } catch {
    QRCodeComponent = null;
  }
  return QRCodeComponent;
}

import {AppHeader} from '../components/AppHeader';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {useSecurity} from '../security/SecurityContext';
import {generateSaltHex} from '../security/pin';
import {i18n} from '../i18n';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {loadWalletTxCache, saveWalletTxCache} from '../storage/sqliteStorage';

type TabKey = 'overview' | 'send' | 'withdraw' | 'history';

type WithdrawItem = {
  id: number;
  amount: number;
  destination: string;
  status: string;
  error?: string | null;
  admin_comment?: string | null;
  payout_tx_id?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
};

function makeIdempotencyKey(prefix: string): string {
  const rnd = generateSaltHex(16);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

function txStableKey(it: any): string {
  const a = it ?? {};
  return String(
    a.tx_id ??
      a.chain_tx_id ??
      a.op_id ??
      a.request_id ??
      a.id ??
      `${a.kind || 'tx'}:${a.ts || 0}:${a.amount || 0}:${a.memo || ''}:${a.status || ''}`,
  );
}

function txTs(it: any): number {
  const v = Number(it?.ts ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function mergeTx(prev: any[], next: any[]): any[] {
  const combined = [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])];
  combined.sort((a, b) => txTs(b) - txTs(a));
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of combined) {
    const k = txStableKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function withdrawStatusLabel(st: any): string {
  const s = String(st || '').toLowerCase();
  if (s === 'pending') return i18n.t('wallet.status.pending');
  if (s === 'approved') return i18n.t('wallet.status.approved');
  if (s === 'paid') return i18n.t('wallet.status.paid');
  if (s === 'rejected') return i18n.t('wallet.status.rejected');
  return s || i18n.t('wallet.status.unknown');
}


export const WalletScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const api = useLexmessApi();
  const security = useSecurity();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [tab, setTab] = useState<TabKey>('overview');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState<number>(0);

  const [qrOpen, setQrOpen] = useState(false);

  const [txItems, setTxItems] = useState<any[]>([]);
  const [txCursor, setTxCursor] = useState<number | null>(null);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);

  const [toAddress, setToAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState<{to: string; amt: number; memo: string | null} | null>(null);

  const [withdrawMin, setWithdrawMin] = useState(0);
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState<{dest: string; amt: number} | null>(null);

  const loadCachedTx = useCallback(async () => {
    try {
      const cached = await loadWalletTxCache(120);
      if (Array.isArray(cached) && cached.length > 0) {
        setTxItems(cached);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadTxFirstPage = useCallback(async () => {
    const res = await api.walletTx({limit: 50, beforeTs: null});
    const items = Array.isArray(res?.items) ? res.items : [];
    const nextBefore = typeof res?.next_before_ts === 'number' ? res.next_before_ts : null;
    setTxItems(items);
    setTxCursor(nextBefore);
    setTxHasMore(!!nextBefore);
    try {
      await saveWalletTxCache(items);
    } catch {
      // ignore cache errors
    }
  }, [api]);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api.walletMe();
      setWalletAddress(String(me?.wallet_address || ''));
      setBalance(Number(me?.balance || 0));
      await loadTxFirstPage();
    } catch (e: any) {
      setError(e?.message || i18n.t('wallet.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [api, loadTxFirstPage]);

  const loadMoreTx = useCallback(async () => {
    if (!txHasMore || txLoadingMore) return;
    const cursor = txCursor;
    if (!cursor || cursor <= 0) return;

    setTxLoadingMore(true);
    try {
      const res = await api.walletTx({limit: 50, beforeTs: cursor});
      const items = Array.isArray(res?.items) ? res.items : [];
      const nextBefore = typeof res?.next_before_ts === 'number' ? res.next_before_ts : null;

      setTxItems(prev => {
        const merged = mergeTx(prev, items);
        // ограничим память
        const limited = merged.slice(0, 200);
        // best-effort cache
        saveWalletTxCache(limited).catch(() => {});
        return limited;
      });
      setTxCursor(nextBefore);
      setTxHasMore(!!nextBefore && items.length > 0);
    } catch {
      // ignore
    } finally {
      setTxLoadingMore(false);
    }
  }, [api, txCursor, txHasMore, txLoadingMore]);

  const loadWithdrawMeta = useCallback(async () => {
    setWithdrawLoading(true);
    try {
      const mr = await api.withdrawMin();
      setWithdrawMin(Number(mr?.min || 0));
      const lst = await api.withdrawList();
      setWithdrawItems(Array.isArray(lst?.items) ? lst.items : []);
    } catch {
      // ignore
    } finally {
      setWithdrawLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCachedTx().catch(() => {});
    loadWallet().catch(() => {});
  }, [loadCachedTx, loadWallet]);

  useEffect(() => {
    if (tab === 'withdraw') {
      loadWithdrawMeta().catch(() => {});
    }
  }, [tab, loadWithdrawMeta]);

  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onSend = useCallback(async () => {
    setSendInfo(null);
    setSendError(null);

    const to = (toAddress || '').trim();
    const amt = parseInt((sendAmount || '').trim(), 10);
    const memo = (sendMemo || '').trim();

    if (!to) {
      setSendError(i18n.t('wallet.errors.missingRecipient'));
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setSendError(i18n.t('wallet.errors.invalidAmount'));
      return;
    }

    setPendingSend({to, amt, memo: memo ? memo : null});
    setConfirmSendOpen(true);
  }, [toAddress, sendAmount, sendMemo]);

  const doSend = useCallback(async () => {
    if (!pendingSend) return;
    setConfirmSendOpen(false);

    const authed = await security.requireSensitiveAuth(i18n.t('wallet.security.sendAuthTitle'));
    if (!authed) {
      setSendError(i18n.t('wallet.errors.operationCancelled'));
      return;
    }

    setSendBusy(true);
    setSendInfo(null);
    setSendError(null);
    try {
      const idem = makeIdempotencyKey('send');
      const res = await api.walletSend({
        toAddress: pendingSend.to,
        amount: pendingSend.amt,
        memo: pendingSend.memo,
        idempotencyKey: idem,
      });
      const opId = res?.op_id ?? res?.id;
      const dup = !!res?.duplicate;
      setSendInfo(
        opId
          ? `${dup ? i18n.t('wallet.info.duplicatePrefix') : ''}${i18n.t('wallet.info.sendCreatedWithId', {
              id: opId,
            })}`
          : i18n.t('wallet.info.sendCreated'),
      );
      setToAddress('');
      setSendAmount('');
      setSendMemo('');
      setPendingSend(null);
      await loadWallet();
    } catch (e: any) {
      setSendError(e?.message || i18n.t('wallet.errors.sendFailed'));
    } finally {
      setSendBusy(false);
    }
  }, [api, pendingSend, loadWallet, security]);

  const onWithdraw = useCallback(async () => {
    setWithdrawInfo(null);
    setWithdrawError(null);

    const dest = (withdrawDestination || '').trim();
    const amt = parseInt((withdrawAmount || '').trim(), 10);

    if (!dest) {
      setWithdrawError(i18n.t('wallet.errors.withdrawMissingDestination'));
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setWithdrawError(i18n.t('wallet.errors.withdrawInvalidAmount'));
      return;
    }
    if (withdrawMin > 0 && amt < withdrawMin) {
      setWithdrawError(i18n.t('wallet.errors.withdrawMin', {amount: withdrawMin}));
      return;
    }

    setPendingWithdraw({dest, amt});
    setConfirmWithdrawOpen(true);
  }, [withdrawDestination, withdrawAmount, withdrawMin]);

  const doWithdraw = useCallback(async () => {
    if (!pendingWithdraw) return;
    setConfirmWithdrawOpen(false);

    const authed = await security.requireSensitiveAuth(i18n.t('wallet.security.withdrawAuthTitle'));
    if (!authed) {
      setWithdrawError(i18n.t('wallet.errors.operationCancelled'));
      return;
    }

    setWithdrawBusy(true);
    setWithdrawInfo(null);
    setWithdrawError(null);
    try {
      const idem = makeIdempotencyKey('withdraw');
      const res = await api.withdrawRequest({
        amount: pendingWithdraw.amt,
        destination: pendingWithdraw.dest,
        idempotencyKey: idem,
      });
      const reqId = res?.request?.id ?? res?.request_id ?? res?.id;
      const dup = !!res?.duplicate;
      setWithdrawInfo(
        reqId
          ? `${dup ? i18n.t('wallet.info.duplicatePrefix') : ''}${i18n.t('wallet.info.withdrawCreatedWithId', {
              id: reqId,
            })}`
          : i18n.t('wallet.info.withdrawCreated'),
      );
      setWithdrawDestination('');
      setWithdrawAmount('');
      setPendingWithdraw(null);
      await loadWithdrawMeta();
      await loadWallet();
    } catch (e: any) {
      setWithdrawError(e?.message || i18n.t('wallet.errors.withdrawFailed'));
    } finally {
      setWithdrawBusy(false);
    }
  }, [api, pendingWithdraw, loadWithdrawMeta, loadWallet, security]);

  const TabButton = ({k, title, isLast}: {k: TabKey; title: string; isLast: boolean}) => {
    const active = tab === k;
    return (
      <TouchableOpacity
        onPress={() => setTab(k)}
        style={[styles.tabBtn, !isLast ? styles.tabBtnSpacing : null, active ? styles.tabBtnActive : null]}
        accessibilityRole="button">
        <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <AppHeader title={i18n.t('wallet.title')} subtitle={i18n.t('wallet.subtitle')} onBack={onBack} />

      <View style={styles.tabs}>
        <TabButton k="overview" title={i18n.t('wallet.tabs.overview')} isLast={false} />
        <TabButton k="send" title={i18n.t('wallet.tabs.send')} isLast={false} />
        <TabButton k="withdraw" title={i18n.t('wallet.tabs.withdraw')} isLast={false} />
        <TabButton k="history" title={i18n.t('wallet.tabs.history')} isLast />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadWallet} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.hint}>{i18n.t('wallet.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={loadWallet}>
              <Text style={styles.btnText}>{i18n.t('wallet.actions.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : tab === 'overview' ? (
          <View style={styles.card}>
            <Text style={styles.label}>{i18n.t('wallet.labels.address')}</Text>
            <View style={styles.rowBetween}>
              <Text style={[styles.mono, styles.flex1]} numberOfLines={1}>
                {walletAddress || i18n.t('wallet.status.unknown')}
              </Text>
              <TouchableOpacity
                style={[styles.btnTiny, !walletAddress ? styles.btnTinyDisabled : null]}
                disabled={!walletAddress}
                onPress={() => setQrOpen(true)}>
                <Text style={styles.btnTinyText}>{i18n.t('wallet.qr.button')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sep} />

            <Text style={styles.label}>{i18n.t('wallet.labels.balance')}</Text>
            <Text style={styles.balance}>{i18n.t('wallet.balanceValue', {amount: balance})}</Text>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnSoft]} onPress={loadWallet}>
                <Text style={styles.btnText}>{i18n.t('wallet.actions.refresh')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>{i18n.t('wallet.hints.transactionsNotice')}</Text>

            <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{i18n.t('wallet.qr.title')}</Text>
                  <View style={styles.qrBox}>
                    {(() => {
                      const Q = getQRCodeComponent();
                      return Q ? (
                        <Q value={walletAddress || i18n.t('wallet.qr.emptyValue')} size={220} />
                      ) : (
                        <Text style={styles.qrFallback}>{i18n.t('wallet.qr.unavailable')}</Text>
                      );
                    })()}
                  </View>
                  <Text style={[styles.mono, styles.modalMono]} numberOfLines={2}>
                    {walletAddress || i18n.t('wallet.status.unknown')}
                  </Text>
                  <TouchableOpacity style={[styles.btn, styles.modalBtn]} onPress={() => setQrOpen(false)}>
                    <Text style={styles.btnText}>{i18n.t('wallet.actions.close')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        ) : tab === 'send' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{i18n.t('wallet.send.title')}</Text>
            <Text style={styles.label}>{i18n.t('wallet.labels.toAddress')}</Text>
            <TextInput
              value={toAddress}
              onChangeText={setToAddress}
              style={styles.input}
              placeholder={i18n.t('wallet.placeholders.address')}
              placeholderTextColor={t.colors.textSecondary}
              autoCapitalize="none"
            />
            <Text style={styles.label}>{i18n.t('wallet.labels.amount')}</Text>
            <TextInput
              value={sendAmount}
              onChangeText={setSendAmount}
              style={styles.input}
              placeholder={i18n.t('wallet.placeholders.sendAmount')}
              placeholderTextColor={t.colors.textSecondary}
              keyboardType="numeric"
            />
            <Text style={styles.label}>{i18n.t('wallet.labels.memoOptional')}</Text>
            <TextInput
              value={sendMemo}
              onChangeText={setSendMemo}
              style={styles.input}
              placeholder={i18n.t('wallet.placeholders.memo')}
              placeholderTextColor={t.colors.textSecondary}
            />

            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            {sendInfo ? <Text style={styles.success}>{sendInfo}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, sendBusy ? styles.btnDisabled : null]}
              disabled={sendBusy}
              onPress={onSend}>
              <Text style={styles.btnText}>
                {sendBusy ? i18n.t('wallet.actions.sending') : i18n.t('wallet.actions.createSend')}
              </Text>
            </TouchableOpacity>

            <Modal visible={confirmSendOpen} transparent animationType="fade" onRequestClose={() => setConfirmSendOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{i18n.t('wallet.send.confirmTitle')}</Text>
                  <Text style={styles.modalText}>{i18n.t('wallet.send.confirmTo')}</Text>
                  <Text style={[styles.mono, styles.modalMono]} numberOfLines={2}>
                    {pendingSend?.to || i18n.t('wallet.status.unknown')}
                  </Text>
                  <Text style={styles.modalText}>
                    {i18n.t('wallet.send.confirmAmount', {amount: pendingSend?.amt ?? 0})}
                  </Text>
                  {pendingSend?.memo ? (
                    <Text style={styles.modalText}>{i18n.t('wallet.send.confirmMemo', {memo: pendingSend.memo})}</Text>
                  ) : null}

                  <View style={styles.rowBetween}>
                    <TouchableOpacity style={[styles.btn, styles.btnSoft, styles.flex1, styles.mr8]} onPress={() => setConfirmSendOpen(false)}>
                      <Text style={styles.btnText}>{i18n.t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.flex1]} onPress={doSend}>
                      <Text style={styles.btnText}>{i18n.t('wallet.actions.confirm')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        ) : tab === 'withdraw' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{i18n.t('wallet.withdraw.title')}</Text>
            {withdrawLoading ? <Text style={styles.hint}>{i18n.t('wallet.loading')}</Text> : null}
            <Text style={styles.hint}>{i18n.t('wallet.withdraw.minHint', {amount: withdrawMin})}</Text>

            <Text style={styles.label}>{i18n.t('wallet.labels.withdrawDestination')}</Text>
            <TextInput
              value={withdrawDestination}
              onChangeText={setWithdrawDestination}
              style={styles.input}
              placeholder={i18n.t('wallet.placeholders.withdrawDestination')}
              placeholderTextColor={t.colors.textSecondary}
              autoCapitalize="none"
            />
            <Text style={styles.label}>{i18n.t('wallet.labels.amount')}</Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              style={styles.input}
              placeholder={i18n.t('wallet.placeholders.withdrawAmount')}
              placeholderTextColor={t.colors.textSecondary}
              keyboardType="numeric"
            />

            {withdrawError ? <Text style={styles.error}>{withdrawError}</Text> : null}
            {withdrawInfo ? <Text style={styles.success}>{withdrawInfo}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, withdrawBusy ? styles.btnDisabled : null]}
              disabled={withdrawBusy}
              onPress={onWithdraw}>
              <Text style={styles.btnText}>
                {withdrawBusy ? i18n.t('wallet.actions.creating') : i18n.t('wallet.actions.createWithdraw')}
              </Text>
            </TouchableOpacity>

            <Modal
              visible={confirmWithdrawOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setConfirmWithdrawOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>{i18n.t('wallet.withdraw.confirmTitle')}</Text>
                  <Text style={styles.modalText}>{i18n.t('wallet.withdraw.confirmDestination')}</Text>
                  <Text style={[styles.mono, styles.modalMono]} numberOfLines={3}>
                    {pendingWithdraw?.dest || i18n.t('wallet.status.unknown')}
                  </Text>
                  <Text style={styles.modalText}>
                    {i18n.t('wallet.withdraw.confirmAmount', {amount: pendingWithdraw?.amt ?? 0})}
                  </Text>

                  <View style={styles.rowBetween}>
                    <TouchableOpacity style={[styles.btn, styles.btnSoft, styles.flex1, styles.mr8]} onPress={() => setConfirmWithdrawOpen(false)}>
                      <Text style={styles.btnText}>{i18n.t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.flex1]} onPress={doWithdraw}>
                      <Text style={styles.btnText}>{i18n.t('wallet.actions.confirm')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <View style={styles.sep} />
            <Text style={styles.cardTitle}>{i18n.t('wallet.withdraw.requestsTitle')}</Text>
            {withdrawItems.length === 0 ? (
              <Text style={styles.hint}>{i18n.t('wallet.withdraw.empty')}</Text>
            ) : (
              <View>
                {withdrawItems.map((it: any) => (
                  <View key={String(it.id)} style={styles.listItem}>
                    <Text style={styles.listTitle}>
                      {i18n.t('wallet.withdraw.itemTitle', {amount: Number(it.amount || 0)})}
                    </Text>
                    <Text style={styles.listMeta}>{it.destination}</Text>
                    <Text style={styles.listMeta}>
                      {i18n.t('wallet.withdraw.statusLabel', {status: withdrawStatusLabel(it.status)})}
                    </Text>
                    {it.error ? (
                      <Text style={styles.error}>{i18n.t('wallet.withdraw.errorLabel', {error: String(it.error)})}</Text>
                    ) : null}
                    {it.admin_comment ? (
                      <Text style={styles.hint}>
                        {i18n.t('wallet.withdraw.adminCommentLabel', {comment: String(it.admin_comment)})}
                      </Text>
                    ) : null}
                    {it.payout_tx_id ? (
                      <Text style={styles.listMeta}>{i18n.t('wallet.withdraw.txLabel', {tx: String(it.payout_tx_id)})}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{i18n.t('wallet.history.title')}</Text>

            {txItems.length === 0 ? (
              <Text style={styles.hint}>{i18n.t('wallet.history.empty')}</Text>
            ) : (
              <View>
                {txItems.map((it: any, idx: number) => (
                  <View key={txStableKey(it) + ':' + String(idx)} style={styles.listItem}>
                    <Text style={styles.listTitle}>
                      {i18n.t('wallet.history.itemTitle', {
                        kind: String(it.kind || 'tx'),
                        amount: Number(it.amount || 0),
                      })}
                    </Text>
                    <Text style={styles.listMeta}>{it.memo ? String(it.memo) : i18n.t('wallet.status.unknown')}</Text>
                    {it.status ? (
                      <Text style={styles.listMeta}>
                        {i18n.t('wallet.history.statusLabel', {status: String(it.status)})}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSoft, (!txHasMore || txLoadingMore) ? styles.btnDisabled : null]}
                disabled={!txHasMore || txLoadingMore}
                onPress={loadMoreTx}>
                <Text style={styles.btnText}>
                  {txLoadingMore
                    ? i18n.t('wallet.loading')
                    : txHasMore
                      ? i18n.t('wallet.actions.loadMore')
                      : i18n.t('wallet.actions.noMore')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    scroll: {flex: 1},
    scrollPad: {padding: 16, paddingBottom: 40},

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingBottom: 10,
      backgroundColor: t.colors.bg,
    },
    tabBtnSpacing: {marginRight: 8},
    tabBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: t.colors.bgElevated,
    },
    tabBtnActive: {
      borderColor: t.colors.accent,
    },
    tabText: {color: t.colors.textSecondary, fontWeight: '700'},
    tabTextActive: {color: t.colors.text, fontWeight: '900'},

    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 18,
      padding: 14,
      backgroundColor: t.colors.bgElevated,
    },
    cardTitle: {color: t.colors.text, fontWeight: '900', fontSize: 16, marginBottom: 10},

    label: {color: t.colors.textSecondary, marginTop: 10, marginBottom: 6},
    mono: {fontFamily: 'monospace', color: t.colors.text},
    balance: {color: t.colors.text, fontWeight: '900', fontSize: 22, marginTop: 6},

    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.colors.text,
      backgroundColor: t.colors.bg,
    },

    btn: {
      borderWidth: 1,
      borderColor: t.colors.accent,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: t.colors.accent,
    },
    btnSoft: {backgroundColor: t.colors.bgElevated},
    btnDisabled: {opacity: 0.6},
    btnText: {color: t.colors.accentText, fontWeight: '900'},

    btnTiny: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.colors.bg,
      marginLeft: 10,
    },
    btnTinyDisabled: {opacity: 0.5},
    btnTinyText: {color: t.colors.text, fontWeight: '900'},

    hint: {color: t.colors.textSecondary, marginTop: 10},
    error: {color: t.colors.danger, marginTop: 10, fontWeight: '700'},
    success: {color: t.colors.success, marginTop: 10, fontWeight: '700'},
    row: {flexDirection: 'row', marginTop: 12},
    rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2},
    flex1: {flex: 1},
    mr8: {marginRight: 8},

    sep: {height: 1, backgroundColor: t.colors.border, marginVertical: 12},

    listItem: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: t.colors.bg,
      marginTop: 10,
    },
    listTitle: {color: t.colors.text, fontWeight: '800'},
    listMeta: {color: t.colors.textSecondary, marginTop: 4},

    center: {alignItems: 'center', justifyContent: 'center', paddingVertical: 24},

    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlayDark,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      padding: 14,
    },
    modalTitle: {color: t.colors.text, fontWeight: '900', fontSize: 16, marginBottom: 10},
    modalText: {color: t.colors.textSecondary, marginTop: 8},
    modalMono: {marginTop: 6},
    modalBtn: {marginTop: 16},
    qrBox: {
      alignSelf: 'center',
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    qrFallback: {color: t.colors.textMuted, textAlign: 'center', ...t.typography.bodyRegular},
  });
