import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
export function EmptyState({title, subtitle}:{title:string; subtitle?:string}){
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </View>
  );
}
const s=StyleSheet.create({
  wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:24,opacity:0.8},
  title:{fontSize:18,fontWeight:'700',marginBottom:6},
  sub:{textAlign:'center'}
});
