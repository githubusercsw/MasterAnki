/**
 * CardListItem — 单张卡片的展示项（纯展示组件）
 *
 * 从 EntryDetailScreen 抽离，props 驱动、无自有状态：
 * - 状态：added（勾选禁用）/ error（警示+重试）/ 待处理（可选+入库按钮）
 * - 操作：选中/取消、单卡入库、编辑跳转、拖拽把手
 */

import React from 'react';
import {
  IonItem,
  IonCheckbox,
  IonLabel,
  IonNote,
  IonIcon,
  IonButton,
  IonReorder,
} from '@ionic/react';
import { checkmarkCircleOutline, createOutline, warningOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import type { Flashcard } from '../lib/anki/types';
import MarkdownRenderer from './MarkdownRenderer';

export interface CardListItemProps {
  card: Flashcard;
  /** 所属条目 id（用于编辑路由 /entry/:id/edit/:cardId） */
  entryId: string;
  /** 当前是否被选中（批量删除用） */
  isSelected: boolean;
  /** 单卡入库进行中（禁用入库按钮） */
  adding: boolean;
  /** 选中/取消（仅待处理卡片触发） */
  onToggleSelect: (cardId: string, checked: boolean) => void;
  /** 单卡入库 */
  onAdd: (card: Flashcard) => void;
}

const CardListItem: React.FC<CardListItemProps> = ({
  card,
  entryId,
  isSelected,
  adding,
  onToggleSelect,
  onAdd,
}) => {
  const { t } = useTranslation();
  return (
    <IonItem key={card.id}>
      {card.status === 'added' ? (
        <IonCheckbox slot="start" checked disabled />
      ) : (
        <IonCheckbox
          slot="start"
          checked={isSelected}
          onIonChange={(e) => onToggleSelect(card.id, e.detail.checked)}
        />
      )}
      <IonLabel>
        <MarkdownRenderer content={card.front} compact />
        <MarkdownRenderer content={card.back} compact />
        <IonNote>{card.type}</IonNote>
        {card.status === 'error' && (
          <IonNote color="danger">
            <IonIcon icon={warningOutline} /> {t('entry.errorStatus')}
          </IonNote>
        )}
      </IonLabel>
      {card.status === 'added' ? (
        <IonIcon icon={checkmarkCircleOutline} slot="end" color="success" />
      ) : (
        <IonButton
          slot="end"
          size="small"
          color={card.status === 'error' ? 'danger' : undefined}
          onClick={() => onAdd(card)}
          disabled={adding}
        >
          {card.status === 'error' ? t('entry.retry') : t('entry.add')}
        </IonButton>
      )}
      <IonButton
        slot="end"
        size="small"
        fill="clear"
        routerLink={`/entry/${entryId}/edit/${card.id}`}
      >
        <IonIcon icon={createOutline} />
      </IonButton>
      <IonReorder slot="end" />
    </IonItem>
  );
};

export default CardListItem;
