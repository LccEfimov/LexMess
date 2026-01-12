import React, {useMemo, useState} from 'react';
import {ScreenContainer} from '../ui/ScreenContainer';
import {Button, ErrorText, Input, Label, SectionTitle, Spacer} from '../ui';
import {AppHeader} from '../components/AppHeader';
import {i18n} from '../i18n';

type Props = {
  onBack: () => void;
  onCreate: (peerUserId: string) => Promise<void>;
};

export const NewDirectChatScreen: React.FC<Props> = ({onBack, onCreate}) => {
  const [peerUserId, setPeerUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => peerUserId.trim().length > 0 && !busy, [peerUserId, busy]);

  const submit = async () => {
    const v = peerUserId.trim();
    if (!v) {
      setError(i18n.t('newDirectChat.errors.missingUserId'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(v);
    } catch (e: any) {
      setError(e?.message || i18n.t('newDirectChat.errors.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title={i18n.t('newDirectChat.title')} onBack={onBack} />
      <Spacer h={14} />
      <SectionTitle>{i18n.t('newDirectChat.subtitle')}</SectionTitle>
      <Spacer h={10} />
      <Label>{i18n.t('newDirectChat.userIdLabel')}</Label>
      <Input
        value={peerUserId}
        onChangeText={setPeerUserId}
        placeholder={i18n.t('newDirectChat.userIdPlaceholder')}
        autoCapitalize="none"
      />
      <Spacer h={10} />
      <ErrorText text={error} />
      <Spacer h={12} />
      <Button
        title={busy ? i18n.t('common.ellipsis') : i18n.t('newDirectChat.create')}
        onPress={submit}
        disabled={!canSubmit}
      />
      <Spacer h={10} />
      <Button title={i18n.t('newDirectChat.cancel')} onPress={onBack} secondary />
      <Spacer h={18} />
    </ScreenContainer>
  );
};
