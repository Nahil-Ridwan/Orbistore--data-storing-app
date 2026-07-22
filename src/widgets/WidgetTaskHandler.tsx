import { Linking } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickAccess } from './QuickAccess';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<QuickAccess />);
      break;

    case 'WIDGET_CLICK':
      if (props.clickAction === 'OPEN_ADD_ENTRY') {
        Linking.openURL('macrotrack://add-entry');
      } else if (props.clickAction === 'OPEN_ALL_ENTRIES') {
        Linking.openURL('macrotrack://entries?search=true');
      }
      break;
  }
}