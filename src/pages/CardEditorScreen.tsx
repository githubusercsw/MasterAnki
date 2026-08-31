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
  IonItem,
  IonLabel,
  IonTextarea,
  IonInput,
  IonButton,
  IonText,
  IonCard,
  IonCardContent,
  IonNote,
  IonSpinner,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import Inbox from '../plugins/Inbox';
import type { CardType } from '../lib/anki/types';
import MarkdownRenderer from '../components/MarkdownRenderer';

const CardEditorScreen: React.FC = () => {
  const { id, cardId } = useParams<{ id: string; cardId: string }>();
  const history = useHistory();
  const { t } = useTranslation();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [type, setType] = useState<CardType>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await Inbox.getEntry({ id });
        const target = (res.cards ?? []).find((c) => c.id === cardId);
        if (target) {
          setFront(target.front);
          setBack(target.back);
          setTags((target.tags ?? []).join(', '));
          setType(target.type);
        }
      } catch {
        setIsSuccess(false);
        setMessage(t('editor.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, cardId]);

  const save = async () => {
    if (!front.trim() || !back.trim()) {
      setIsSuccess(false);
      setMessage(t('editor.required'));
      return;
    }
    setSaving(true);
    setIsSuccess(false);
    setMessage('');
    try {
      await Inbox.updateCardContent({
        cardId,
        front,
        back,
        type,
        tags: tags.split(/[,，\s]+/).filter(Boolean),
      });
      setIsSuccess(true);
      setMessage(t('editor.updated'));
      setTimeout(() => history.goBack(), 800);
    } catch (e) {
      setIsSuccess(false);
      setMessage(e instanceof Error ? e.message : t('editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton />
          </IonButtons>
          <IonTitle>{t('editor.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardContent>
            <IonText>
              <h2 style={{ marginTop: 0 }}>{type.toUpperCase()} Card</h2>
              <p>{t('editor.desc')}</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        {type === 'cloze' ? (
          <IonItem>
            <IonLabel position="stacked">
              {t('create.textWithCloze', { code: '{{c1::...}}' })}
            </IonLabel>
            <IonTextarea
              value={front}
              rows={4}
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        ) : (
          <IonItem>
            <IonLabel position="stacked">{t('editor.front')}</IonLabel>
            <IonTextarea
              value={front}
              rows={3}
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        )}

        <IonItem>
          <IonLabel position="stacked">{t('editor.back')}</IonLabel>
          <IonTextarea
            value={back}
            rows={3}
            onIonInput={(e) => setBack(String(e.detail.value ?? ''))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">{t('editor.tags')}</IonLabel>
          <IonInput value={tags} onIonInput={(e) => setTags(String(e.detail.value ?? ''))} />
        </IonItem>

        {/* 实时预览（Markdown 渲染） */}
        {(front.trim() || back.trim()) && (
          <IonCard style={{ marginTop: '1rem' }}>
            <IonCardContent>
              <IonNote color="medium">{t('editor.preview')}</IonNote>
              {front.trim() && (
                <div style={{ marginTop: '0.5rem' }}>
                  <MarkdownRenderer content={front} compact />
                </div>
              )}
              {back.trim() && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    borderTop: '1px solid var(--ma-border)',
                    paddingTop: '0.5rem',
                  }}
                >
                  <MarkdownRenderer content={back} compact />
                </div>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {message && (
          <IonNote
            color={isSuccess ? 'success' : 'danger'}
            style={{ display: 'block', marginTop: '0.75rem' }}
          >
            {message}
          </IonNote>
        )}

        <IonButton expand="block" onClick={save} disabled={saving} style={{ marginTop: '1.5rem' }}>
          {t('editor.saveChanges')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default CardEditorScreen;
