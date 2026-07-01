'use client';

import React from 'react';
import {
  CertificateFormData,
  DEFAULT_HEAD_NAME,
  DEFAULT_INSPECTION_BODY,
  DEFAULT_STANDARD,
  formatDateForText,
  parseDateParts,
} from '@/lib/certificateTypes';

interface Props {
  formData: CertificateFormData;
  previewBackground: boolean;
}

interface BoxProps {
  x: number;
  y: number;
  width: number;
  height?: number;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  bold?: boolean;
}

const SOURCE_Y_START = 81;
const PAGE_Y_START = 76;
const Y_SCALE = 0.67;

function yPos(y: number) {
  return PAGE_Y_START + (y - SOURCE_Y_START) * Y_SCALE;
}

function Box({ x, y, width, height, children, className = '', align = 'left', fontSize = 10.5, bold = false }: BoxProps) {
  return (
    <div
      className={`cert-box ${className}`}
      style={{
        left: `${x}mm`,
        top: `${yPos(y)}mm`,
        width: `${width}mm`,
        height: height ? `${height}mm` : undefined,
        textAlign: align,
        fontSize: `${fontSize}pt`,
        fontWeight: bold ? 700 : 400,
      }}
    >
      {children}
    </div>
  );
}

function Underline({ x, y, width }: { x: number; y: number; width: number }) {
  return <div className="cert-underline" style={{ left: `${x}mm`, top: `${yPos(y)}mm`, width: `${width}mm` }} />;
}

function fitClass(value: string, medium = 58, small = 92) {
  if (value.length > small) return 'cert-fit cert-fit-small';
  if (value.length > medium) return 'cert-fit cert-fit-medium';
  return 'cert-fit';
}

export default function CertificateEditor({ formData, previewBackground }: Props) {
  const issue = parseDateParts(formData.issueDate);
  const validTo = parseDateParts(formData.validTo);
  const standard = formData.standard || DEFAULT_STANDARD;
  const inspectionBody = formData.inspectionBody || DEFAULT_INSPECTION_BODY;
  const headName = formData.headName || DEFAULT_HEAD_NAME;

  return (
    <div id="print-area" className="shahodatnoma-page">
      {previewBackground && <div className="certificate-preview-bg" aria-hidden="true" />}

      <div className="certificate-overlay" aria-label="Печатный слой свидетельства">
        <Box x={77} y={81.8} width={45} align="center" fontSize={13.5} bold>
          Эътибор дорад
        </Box>
        <Box x={125.2} y={82.1} width={9} align="center" fontSize={12} bold>
          аз
        </Box>
        <Box x={137.2} y={81.6} width={18} align="center" fontSize={12} bold>
          « {issue.day || '__'} »
        </Box>
        <Box x={160.5} y={81.6} width={25} align="center" fontSize={12} bold>
          {issue.month || '________'}
        </Box>
        <Box x={188} y={81.6} width={18} align="center" fontSize={12}>
          {issue.year || '____'} с.
        </Box>
        <Underline x={137} y={87.2} width={67} />

        <Box x={126.5} y={94.1} width={8} align="center" fontSize={12} bold>
          то
        </Box>
        <Box x={137.2} y={93.6} width={18} align="center" fontSize={12} bold>
          « {validTo.day || '__'} »
        </Box>
        <Box x={160.5} y={93.6} width={25} align="center" fontSize={12} bold>
          {validTo.month || '________'}
        </Box>
        <Box x={188} y={93.6} width={18} align="center" fontSize={12}>
          {validTo.year || '____'} с.
        </Box>
        <Underline x={137} y={99.2} width={67} />

        <Box x={17} y={93} width={75} fontSize={11.5} bold>
          №{formData.certificateNumber || 'TJ.762.37100.01.016 — 2025'}
        </Box>

        <Box x={16} y={106.4} width={118} fontSize={11.5} bold>
          Шаҳодатномаи мазкур тасдиқ менамояд, ки хизматрасонии
        </Box>
        <Box x={131.2} y={104.6} width={74} align="center" fontSize={13.5} bold className={fitClass(formData.organizationName, 34, 54)}>
          {formData.organizationName || 'Магозаи хӯрокворӣ'}
        </Box>
        <Underline x={132} y={112.8} width={73} />

        <Box x={16} y={113.7} width={188} align="center" fontSize={12.2} bold className={fitClass(formData.address, 74, 112)}>
          {formData.address || 'шаҳри Душанбе, ноҳияи И. Сомонӣ, хиёбони Рӯдакӣ 185'}
        </Box>
        <Underline x={16} y={122} width={188} />
        <Box x={74} y={122.3} width={62} align="center" fontSize={7.2} bold>
          (номгӯй муассиса ё иштирокчии хизматрасонӣ)
        </Box>

        <Box x={16} y={131.4} width={188} align="center" fontSize={12.5} bold className={fitClass(formData.entrepreneurName, 36, 60)}>
          {formData.entrepreneurName || 'Каримов Э.'}
        </Box>
        <Underline x={16} y={139.3} width={188} />
        <Box x={78} y={139.5} width={54} align="center" fontSize={7.2} bold>
          (ному насаби роҳбари ташкилот)
        </Box>

        <Box x={16} y={145} width={188} fontSize={10.6} className="cert-justify" bold>
          дар асоси Кодексҳои Ҷумҳурии Тоҷикистон «Дар бораи баҳодиҳии мутобиқат», «Дар бораи ҳимояи ҳуқуқи истеъмолкунандагон»,
          «Дар бораи бамеъёрдарории техникӣ», «Дар бораи стандартонӣ», «Дар бораи таъмини ченаки ягона»,
          «Дар бораи савдо ва хизматрасонии маишӣ», «Дар бораи бехатарии маҳсулоти хӯрокворӣ» аз ҷониби Тоҷикстандарт
          баҳогузорӣ карда шуда, субъекти хоҷагидори мазкур имконияти иҷрои
        </Box>

        <Box x={16} y={175.2} width={188} align="left" fontSize={12} bold className={fitClass(formData.serviceType, 70, 112)}>
          {formData.serviceType || 'хизматрасонии савдои чакана'}
        </Box>
        <Underline x={16} y={184.2} width={188} />
        <Underline x={16} y={192.1} width={188} />
        <Box x={87} y={192.2} width={48} align="center" fontSize={7.2} bold>
          (номгӯй кору хизматрасонӣ)
        </Box>

        <Box x={16} y={201.2} width={40} fontSize={10.8} bold>
          мутобиқи талаботи
        </Box>
        <Box x={57} y={198.7} width={63} align="center" fontSize={13.5} bold className={fitClass(standard, 24, 34)}>
          {standard}
        </Box>
        <Underline x={56} y={207.7} width={130} />
        <Box x={187} y={201.2} width={17} fontSize={10.8} bold>
          дорад.
        </Box>
        <Box x={88} y={208.2} width={54} align="center" fontSize={7.2} bold>
          (ифодаи номгӯи ҳуҷҷати меъёрии техникӣ)
        </Box>

        <Box x={31} y={218.1} width={171} fontSize={10.6} className="cert-justify" bold>
          Шаҳодатнома дода шуд дар асоси хулосаи (тасдиқномаи) баҳогузорӣ оид ба тасдиқи мутобиқати хизматрасонии субъекти хоҷагидор
          ба талаботи ҳуҷҷати меъёрии техникӣ
        </Box>
        <Box x={16} y={235.2} width={85} fontSize={10.8} bold>
          аз {formatDateForText(formData.conclusionDate) || '__.__.____с.'} № {formData.applicationNumber || '____'}
        </Box>
        <Underline x={16} y={242.6} width={188} />

        <Box x={16} y={245.5} width={133} fontSize={10.3} bold>
          Ҳангоми шаҳодатномадиҳӣ ҳуҷҷати муайянкунандаи ҳуқуқи фаъолияти субъекти хоҷагидор
        </Box>
        <Box x={16} y={253.8} width={170} fontSize={10.5} bold className={fitClass(formData.patentNumber, 64, 98)}>
          {formData.patentNumber || 'Шаҳодатномаи Кумитаи андоз'}
        </Box>
        <Box x={187} y={253.8} width={18} fontSize={10.5} bold>
          ба инобат гирифта шуд.
        </Box>
        <Underline x={16} y={261.2} width={188} />

        <Box x={25} y={263.2} width={178} fontSize={10.4} className="cert-justify" bold>
          Дархосткунанда (иҷрокунандаи кор ва хизматрасонӣ) барои мутобиқати кору хизматрасонӣ ба талаботи муқарраргардидаи
          ҳуҷҷати меъёрии техникӣ, ки дар шаҳодатнома дарҷ гардидааст ва огоҳ намудани истеъмолкунанда дар бобати доштани
          шаҳодатнома масъул мебошад.
        </Box>

        <Box x={16} y={282.8} width={74} fontSize={10.4} bold>
          Назорати инспексионӣ аз ҷониби
        </Box>
        <Box x={78} y={282.1} width={58} align="center" fontSize={11.2} bold className={fitClass(inspectionBody, 20, 34)}>
          {inspectionBody}
        </Box>
        <Underline x={78} y={289.8} width={58} />
        <Box x={158} y={282.8} width={45} fontSize={10.4} bold>
          амалӣ карда мешавад.
        </Box>
        <Box x={83} y={290.2} width={49} align="center" fontSize={7.2} bold>
          (номгӯи идорамот оид ба шаҳодатномадиҳӣ)
        </Box>

        <Box x={18} y={299.7} width={38} fontSize={10.5} bold>
          Қайдҳои махсус
        </Box>
        <Underline x={54} y={307.2} width={150} />

        <Box x={26} y={310} width={177} fontSize={10.4} className="cert-justify" bold>
          Дар ҳолати иҷро нагардидани талаботи муқарраргардида шаҳодатномаи мазкур аз эътибор соқит дониста мешавад.
        </Box>

        <Box x={133} y={326.5} width={62} align="center" fontSize={11.4} bold>
          Роҳбари мақомот
        </Box>
        <Box x={32} y={340} width={14} fontSize={11.3} bold>
          Ч.М
        </Box>
        <Underline x={50} y={348.2} width={36} />
        <Box x={61} y={349.2} width={16} align="center" fontSize={7.3} bold>
          (имзо)
        </Box>
        <Box x={132} y={339.2} width={62} align="center" fontSize={12.4} bold>
          {headName}
        </Box>
        <Underline x={132} y={348.2} width={62} />
        <Box x={151} y={349.2} width={24} align="center" fontSize={7.3} bold>
          (ному насаб)
        </Box>
      </div>
    </div>
  );
}
