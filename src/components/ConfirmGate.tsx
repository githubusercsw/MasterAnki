/**
 * ConfirmGate — 人工确认门组件
 *
 * 自动化缺把关的治理落地：任何批量/增量/破坏性操作，先展示变更摘要，
 * 由用户显式确认后才执行。本组件为受控组件（open 由调用方管理）。
 */

import React from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonNote,
  IonText,
} from '@ionic/react';
import {
  addCircleOutline,
  swapHorizontalOutline,
  removeCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import type { CardChangeSummary } from '../lib/anki/dedupService';

export interface ConfirmGateProps {
  open: boolean;
  /** 门标题（如"增量更新确认"） */
  title: string;
  /** 副标题说明（如"检测到该来源已生成过卡片"） */
  subtitle?: string;
  summary?: CardChangeSummary;
  /** 自定义正文（无 summary 时使用） */
  description?: string;
  /** 确认中（防重复提交） */
  busy?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Row({
  icon,
  iconColor,
  label,
  detail,
}: {
  icon: string;
  iconColor: string;
  label: string;
  detail: string;
}) {
  return (
    <IonItem>
      <IonIcon icon={icon} slot="start" color={iconColor} />
      <IonLabel>{label}</IonLabel>
      <IonNote slot="end">{detail}</IonNote>
    </IonItem>
  );
}

const ConfirmGate: React.FC<ConfirmGateProps> = ({
  open,
  title,
  subtitle,
  summary,
  description,
  busy = false,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const resolvedConfirm = confirmLabel ?? t('common.confirmExecute');
  const resolvedCancel = cancelLabel ?? t('common.cancel');
  return (
    <IonModal isOpen={open} onDidDismiss={busy ? undefined : onCancel}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel} disabled={busy}>
              {resolvedCancel}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {subtitle && (
          <IonText color="medium">
            <p>{subtitle}</p>
          </IonText>
        )}

        {summary ? (
          <IonList lines="full">
            <Row
              icon={addCircleOutline}
              iconColor="primary"
              label={t('confirmGate.added')}
              detail={`${summary.added.length}`}
            />
            <Row
              icon={checkmarkCircleOutline}
              iconColor="medium"
              label={t('confirmGate.unchanged')}
              detail={`${summary.unchanged.length}`}
            />
            <Row
              icon={swapHorizontalOutline}
              iconColor="warning"
              label={t('confirmGate.changed')}
              detail={`${summary.changed.length}`}
            />
            <Row
              icon={removeCircleOutline}
              iconColor="danger"
              label={t('confirmGate.removed')}
              detail={`${summary.removed.length}`}
            />
          </IonList>
        ) : (
          description && (
            <IonText>
              <p>{description}</p>
            </IonText>
          )
        )}

        {summary && summary.changed.length > 0 && (
          <IonList lines="inset">
            {summary.changed.map(({ before, after }) => (
              <IonItem key={after.id}>
                <IonLabel className="ion-text-wrap">
                  <p className="ma-strikethrough">{before.front}</p>
                  <p>{after.front}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '1.5rem',
          }}
        >
          <IonButton expand="block" fill="outline" onClick={onCancel} disabled={busy}>
            {resolvedCancel}
          </IonButton>
          <IonButton expand="block" onClick={onConfirm} disabled={busy}>
            {busy ? t('common.processing') : resolvedConfirm}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ConfirmGate;
