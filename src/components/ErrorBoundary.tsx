import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {i18n} from '../i18n';

type State = {hasError: boolean; error?: any};
type Props = React.PropsWithChildren<{title?: string; message?: string; actionLabel?: string}>;

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(error: any) {
    return {hasError: true, error};
  }

  componentDidCatch(error: any) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.title ?? i18n.t('app.error.title');
      const message = this.props.message ?? i18n.t('app.error.body');
      const actionLabel = this.props.actionLabel ?? i18n.t('app.error.action');
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{message}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({hasError: false, error: undefined})}>
            <Text style={styles.btnText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children as any;
  }
}

const styles = StyleSheet.create({
  wrap: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  title: {fontSize: 18, fontWeight: '700', marginBottom: 8},
  desc: {opacity: 0.8, marginBottom: 16, textAlign: 'center'},
  btn: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1},
  btnText: {fontWeight: '600'},
});
