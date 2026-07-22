"use no memo";

import React from 'react';
import { FlexWidget, ImageWidget } from 'react-native-android-widget';

export function QuickAccess() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        flexDirection: 'row',
        padding: 9,
        marginVertical: 12,
      }}
    >
      <FlexWidget
        clickAction="OPEN_ADD_ENTRY"
        style={{
          flex: 1,
          height: 'match_parent',
          backgroundColor: '#2a2a4a',
          borderRadius: 16,
          marginRight: 4,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ImageWidget
          image={require('../../assets/images/add-outline.png')}
          imageWidth={27}
          imageHeight={27}
        />
      </FlexWidget>

      <FlexWidget
        clickAction="OPEN_ALL_ENTRIES"
        style={{
          flex: 1,
          height: 'match_parent',
          backgroundColor: '#2a2a4a',
          borderRadius: 16,
          marginLeft: 4,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ImageWidget
          image={require('../../assets/images/search-outline.png')}
          imageWidth={27}
          imageHeight={27}
          style={{ marginLeft: 1 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}