import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonText,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import Inbox from '../plugins/Inbox';
import type { CardType } from '../lib/anki/types';

const ManualCreateScreen: React.FC = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [type, setType] = useState<CardType>('basic');
  const [deckName, setDeckName] = useState('MasterAnki');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!front.trim() || !back.trim()) {
      setIsSuccess(false);
      setMessage(t('create.required'));
      return;
    }
    setSaving(true);
    setIsSuccess(false);
    setMessage('');
    try {
      const entryId = crypto.randomUUID();
      await Inbox.saveEntry({
        entry: {
          id: entryId,
          contentType: 'text',
          content: front,
          preview: front.slice(0, 120),
          title: front.slice(0, 60),
          deckName,
          isLocked: true,
        },
      });
      await Inbox.saveCards({
        entryId,
        cards: [
          {
            front,
            back,
            type,
            tags: tags.split(/[,，\s]+/).filter(Boolean),
          },
        ],
      });
      setIsSuccess(true);
      setMessage(t('create.created'));
      setTimeout(() => history.push('/inbox'), 800);
    } catch (e) {
      setIsSuccess(false);
      setMessage(e instanceof Error ? e.message : t('create.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inbox" />
          </IonButtons>
          <IonTitle>{t('create.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardContent>
            <IonText>
              <h2 style={{ marginTop: 0 }}>{t('create.heading')}</h2>
              <p>{t('create.desc', { code: '{{c1::answer}}' })}</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonItem>
          <IonLabel position="stacked">{t('create.cardType')}</IonLabel>
          <IonSelect value={type} onIonChange={(e) => setType(e.detail.value as CardType)}>
            <IonSelectOption value="basic">{t('create.basic')}</IonSelectOption>
            <IonSelectOption value="cloze">{t('create.cloze')}</IonSelectOption>
            <IonSelectOption value="image_occlusion">{t('create.imageOcclusion')}</IonSelectOption>
          </IonSelect>
        </IonItem>

        {type === 'cloze' ? (
          <IonItem>
            <IonLabel position="stacked">
              {t('create.textWithCloze', { code: '{{c1::...}}' })}
            </IonLabel>
            <IonTextarea
              value={front}
              rows={4}
              placeholder="The capital of France is {{c1::Paris}}."
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        ) : (
          <IonItem>
            <IonLabel position="stacked">{t('create.front')}</IonLabel>
            <IonTextarea
              value={front}
              rows={3}
              placeholder={t('create.front')}
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        )}

        <IonItem>
          <IonLabel position="stacked">{t('create.back')}</IonLabel>
          <IonTextarea
            value={back}
            rows={3}
            placeholder={t('create.back')}
            onIonInput={(e) => setBack(String(e.detail.value ?? ''))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">{t('create.tags')}</IonLabel>
          <IonInput value={tags} onIonInput={(e) => setTags(String(e.detail.value ?? ''))} />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">{t('create.deckName')}</IonLabel>
          <IonInput
            value={deckName}
            onIonInput={(e) => setDeckName(String(e.detail.value ?? ''))}
          />
        </IonItem>

        {message && (
          <IonNote
            color={isSuccess ? 'success' : 'danger'}
            style={{ display: 'block', marginTop: '0.75rem' }}
          >
            {message}
          </IonNote>
        )}

        <IonButton expand="block" onClick={save} disabled={saving} style={{ marginTop: '1.5rem' }}>
          {t('create.saveCard')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ManualCreateScreen;
