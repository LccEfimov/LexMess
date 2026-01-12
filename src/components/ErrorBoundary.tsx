import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {logger} from '../utils/logger';

type State = {hasError: boolean; error?: any};

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(error: any) {
    return {hasError: true, error};
  }

  componentDidCatch(error: any) {
    logger.error('ErrorBoundary', 'uncaught error', {error});
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Произошла ошибка</Text>
          <Text style={styles.desc}>Попробуйте перезапустить приложение.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({hasError: false, error: undefined})}>
            <Text style={styles.btnText}>Продолжить</Text>
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
