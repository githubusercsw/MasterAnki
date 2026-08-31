import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonNote,
  IonCard,
  IonCardContent,
  IonBadge,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { documentTextOutline, ellipsisHorizontalOutline, imageOutline } from 'ionicons/icons';
import { MODELS } from '../lib/anki/ankidroid';
import { isImageOcclusionAvailable } from '../lib/anki/ioDependency';
import type { CardType } from '../lib/anki/types';

interface TemplateOption {
  type: CardType;
  icon: string;
  descKey: string;
  requiresIO: boolean;
}

const TEMPLATES: TemplateOption[] = [
  { type: 'basic', icon: documentTextOutline, descKey: 'template.basicDesc', requiresIO: false },
  {
    type: 'cloze',
    icon: ellipsisHorizontalOutline,
    descKey: 'template.clozeDesc',
    requiresIO: false,
  },
  { type: 'image_occlusion', icon: imageOutline, descKey: 'template.ioDesc', requiresIO: true },
];

const TemplateSelectScreen: React.FC = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const history = useHistory();
  const { t } = useTranslation();
  const [ioAvailable, setIoAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void isImageOcclusionAvailable().then(setIoAvailable);
  }, []);

  const canSelect = (tpl: TemplateOption): boolean => {
    if (!tpl.requiresIO) return true;
    return ioAvailable === true;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton />
          </IonButtons>
          <IonTitle>{t('template.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonText>
          <h2>{t('template.choose')}</h2>
          <p>{t('template.desc')}</p>
        </IonText>
        <IonList style={{ marginTop: '1rem' }}>
          {TEMPLATES.map((tpl) => {
            const enabled = canSelect(tpl);
            const nameKey =
              tpl.type === 'image_occlusion'
                ? 'template.ioName'
                : tpl.type === 'cloze'
                  ? 'template.clozeName'
                  : 'template.basicName';
            return (
              <IonItem
                key={tpl.type}
                button
                disabled={!enabled}
                onClick={() => history.push(`/entry/${entryId}/template/${tpl.type}`)}
              >
                <IonIcon icon={tpl.icon} slot="start" />
                <IonLabel>
                  <h3>{t(nameKey)}</h3>
                  <p>{t(tpl.descKey, { code: '{{c1::answer}}' })}</p>
                </IonLabel>
                {tpl.requiresIO && !enabled ? (
                  <IonBadge slot="end" color="medium">
                    {t('template.needsIo')}
                  </IonBadge>
                ) : (
                  <IonNote slot="end">{MODELS[tpl.type].key}</IonNote>
                )}
              </IonItem>
            );
          })}
        </IonList>
        <IonCard style={{ marginTop: '1rem' }}>
          <IonCardContent>
            <IonNote>
              {ioAvailable === false ? t('template.ioNoteAvailable') : t('template.ioNoteMissing')}
            </IonNote>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default TemplateSelectScreen;
