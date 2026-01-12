import React, {useMemo, useState} from 'react';
import {ScreenContainer} from '../ui/ScreenContainer';
import {Button, ErrorText, Input, Label, SectionTitle, Spacer} from '../ui/kit';
import {AppHeader} from '../components/AppHeader';

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
      setError('Введите ID пользователя');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(v);
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать чат');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Новый чат" onBack={onBack} />
      <Spacer h={14} />
      <SectionTitle>Личный диалог (1:1)</SectionTitle>
      <Spacer h={10} />
      <Label>ID пользователя</Label>
      <Input
        value={peerUserId}
        onChangeText={setPeerUserId}
        placeholder="UUID или ID из профиля"
        autoCapitalize="none"
      />
      <Spacer h={10} />
      <ErrorText text={error} />
      <Spacer h={12} />
      <Button title={busy ? '...' : 'Создать чат'} onPress={submit} disabled={!canSubmit} />
      <Spacer h={10} />
      <Button title="Отмена" onPress={onBack} secondary />
      <Spacer h={18} />
    </ScreenContainer>
  );
};
