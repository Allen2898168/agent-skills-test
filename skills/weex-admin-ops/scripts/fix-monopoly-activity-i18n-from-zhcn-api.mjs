#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/fix-monopoly-activity-i18n-from-zhcn-api.mjs --activity-id <id>

Options:
  --activity-id <id>     required; activityId
  --overwrite            overwrite existing non-empty fields (default true)
  --dry-run              print plan only; no writes
  --help                 show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help", "--overwrite"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  args.overwrite = args.overwrite !== false; // default true
  args.activityId = args.activityId != null ? Number(args.activityId) : NaN;
  if (!args.help) {
    if (!Number.isFinite(args.activityId) || args.activityId <= 0) throw new Error("--activity-id is required");
  }
  return args;
}

const FIELDS = ["title", "subTitle", "myShareContent", "shareContent", "agentShareContent", "intro"];

function nonEmpty(value) {
  return value != null && String(value).trim() !== "";
}

function pickText(rec, key) {
  const v = rec?.[key];
  return v == null ? "" : String(v);
}

function applyText(rec, key, value, { overwrite }) {
  if (!overwrite && nonEmpty(rec?.[key])) return rec;
  return { ...rec, [key]: value };
}

function buildIntroHtml(lines) {
  return lines.map(text => `<p>${text}</p>`).join("");
}

function buildTranslationsFromZh({ zhTitle, zhSubTitle, zhMyShareContent, zhShareContent, zhAgentShareContent, zhIntroHtml }) {
  // The requested activity currently has many empty language packs. We fill them with translations derived from zh_CN.
  // NOTE: For safety and speed, we translate into common target languages; for any unknown lang code, we fall back to English.

  const intro = {
    en_US: buildIntroHtml([
      "1. Click [Register Now] to sign up before participating.",
      "2. The New User exclusive event is limited to users who register during the event period. Market makers and institutional users are not eligible and cannot receive rewards.",
      "3. This event is not applicable to API users; trading volume generated via API will not be counted.",
      "4. Net deposit = deposit − withdrawal. Deposits include on-chain deposits and C2C only; internal transfers are not counted. Spot trading volume = buy volume + sell volume. Futures trading volume = open volume + close volume.",
      "5. Rewards will be distributed within 10 working days after the event ends. Futures trial funds are valid for 3 days. The total prize pool is first-come, first-served; once distributed, it ends. Please pay attention to your account balance. Read the event content and supplemental rules carefully for details.",
      "6. If batch registrations, wash trading, cheating, or other violations are detected, participation eligibility and rewards will be canceled.",
      "7. WEEX reserves the right to modify the event conditions, cancel, extend, terminate, or suspend the event, and adjust reward standards at any time without prior notice.",
      "8. All participants must comply with the revised terms. WEEX reserves the final right of interpretation. If you have questions, please contact online customer service.",
    ]),
    zh_TW: buildIntroHtml([
      "1. 需點擊【立即報名】完成報名後，方可成功參與活動。",
      "2. 新用戶專屬活動僅限活動期間註冊的新用戶參與。做市商與機構用戶不可參與，亦無法獲得獎勵。",
      "3. 本活動不適用於 API 用戶；透過 API 產生的交易量將不計入統計範圍。",
      "4. 淨充值 = 充值 − 提現，充值僅限鏈上充值與 C2C，站內轉帳不計入。現貨交易量 = 買入量 + 賣出量，合約交易量 = 開倉交易量 + 平倉交易量。",
      "5. 獎勵將於活動結束後 10 個工作日內發放，合約體驗金有效期為 3 天；總獎金池先到先得，發完即止，請留意帳戶餘額。具體發放請仔細閱讀活動內容及補充內容。",
      "6. 如有批量註冊、刷量、作弊或其他違規行為，一經發現將取消其參與資格及獎勵。",
      "7. WEEX 保留隨時修改活動條件、取消、延長、終止或暫停活動，以及調整獎勵標準之權利，恕不另行通知。",
      "8. 所有參與者需遵守經修訂之條款，WEEX 對活動擁有最終解釋權。如有疑問，請聯繫線上客服。",
    ]),
    ru_RU: buildIntroHtml([
      "1. Нажмите «Зарегистрироваться сейчас», чтобы подать заявку и участвовать в акции.",
      "2. Акция для новых пользователей доступна только тем, кто зарегистрировался в период проведения. Маркет-мейкеры и институциональные пользователи не допускаются и не получают награды.",
      "3. Акция не распространяется на пользователей API; объём торгов, созданный через API, не учитывается.",
      "4. Чистое пополнение = пополнение − вывод. Учитываются только пополнения on-chain и C2C; внутренние переводы не учитываются. Спотовый объём = объём покупок + объём продаж. Фьючерсный объём = объём открытия + объём закрытия позиций.",
      "5. Награды будут начислены в течение 10 рабочих дней после окончания акции. Срок действия фьючерсного демо/триал-баланса — 3 дня. Призовой фонд распределяется по принципу «кто успел — тот получил» до исчерпания. Следите за балансом. Подробности — в описании и дополнительных правилах акции.",
      "6. При выявлении массовых регистраций, накрутки объёмов, мошенничества или других нарушений участие и награды будут аннулированы.",
      "7. WEEX оставляет за собой право изменять условия, отменять, продлевать, прекращать или приостанавливать акцию, а также корректировать награды без предварительного уведомления.",
      "8. Все участники обязаны соблюдать обновлённые условия. WEEX имеет окончательное право толкования. При вопросах обращайтесь в онлайн‑поддержку.",
    ]),
    ko_KR: buildIntroHtml([
      "1. [지금 신청]을 눌러 신청해야 이벤트에 정상적으로 참여할 수 있습니다.",
      "2. 신규 사용자 전용 이벤트는 이벤트 기간 내 가입한 신규 사용자만 참여할 수 있습니다. 마켓메이커 및 기관 사용자는 참여/보상 수령이 불가합니다.",
      "3. 본 이벤트는 API 사용자에게 적용되지 않으며, API로 발생한 거래량은 집계에서 제외됩니다.",
      "4. 순입금 = 입금 − 출금. 입금은 온체인 입금과 C2C만 포함되며 내부 이체는 제외됩니다. 현물 거래량 = 매수량 + 매도량, 선물(계약) 거래량 = 신규 포지션 거래량 + 청산(종료) 거래량.",
      "5. 보상은 이벤트 종료 후 10영업일 이내 지급됩니다. 선물 체험금 유효기간은 3일이며, 총 상금 풀은 선착순으로 소진 시 종료됩니다. 계정 잔액을 확인해 주세요. 자세한 내용은 이벤트 안내 및 추가 규정을 확인하세요.",
      "6. 대량 가입, 거래량 조작, 부정행위 등 위반이 확인되면 참여 자격 및 보상이 취소됩니다.",
      "7. WEEX는 사전 공지 없이 이벤트 조건을 수정하거나 이벤트를 취소/연장/종료/중단하고 보상 기준을 조정할 권리를 보유합니다.",
      "8. 모든 참가자는 개정된 약관을 준수해야 하며, WEEX는 최종 해석 권한을 가집니다. 문의는 온라인 고객센터로 연락해 주세요.",
    ]),
    vi_VN: buildIntroHtml([
      "1. Cần nhấn [Đăng ký ngay] để đăng ký thì mới tham gia sự kiện thành công.",
      "2. Sự kiện dành riêng cho người dùng mới chỉ áp dụng cho người dùng đăng ký trong thời gian diễn ra sự kiện. Nhà tạo lập thị trường và người dùng tổ chức không đủ điều kiện và không nhận thưởng.",
      "3. Sự kiện không áp dụng cho người dùng API; khối lượng giao dịch phát sinh qua API sẽ không được tính.",
      "4. Nạp ròng = Nạp − Rút. Nạp chỉ bao gồm nạp on-chain và C2C; chuyển khoản nội bộ không được tính. Khối lượng spot = mua + bán. Khối lượng hợp đồng = mở vị thế + đóng vị thế.",
      "5. Thưởng sẽ được phát trong vòng 10 ngày làm việc sau khi sự kiện kết thúc. Tiền trải nghiệm hợp đồng có hiệu lực 3 ngày. Tổng quỹ thưởng theo nguyên tắc ai đến trước nhận trước, hết là dừng. Vui lòng chú ý số dư. Đọc kỹ nội dung và phần bổ sung của sự kiện.",
      "6. Nếu phát hiện đăng ký hàng loạt, tạo khối lượng, gian lận hoặc vi phạm khác, sẽ hủy tư cách tham gia và phần thưởng.",
      "7. WEEX có quyền sửa đổi điều kiện, hủy, gia hạn, chấm dứt hoặc tạm dừng sự kiện và điều chỉnh tiêu chuẩn thưởng bất cứ lúc nào mà không cần thông báo trước.",
      "8. Tất cả người tham gia phải tuân thủ các điều khoản đã sửa đổi; WEEX có quyền giải thích cuối cùng. Nếu có thắc mắc, vui lòng liên hệ CSKH trực tuyến.",
    ]),
    uk_UK: buildIntroHtml([
      "1. Натисніть «Зареєструватися зараз», щоб зареєструватися та взяти участь у події.",
      "2. Подія для нових користувачів доступна лише тим, хто зареєструвався під час періоду події. Маркет-мейкери та інституційні користувачі не можуть брати участь і отримувати винагороди.",
      "3. Подія не поширюється на користувачів API; обсяг торгів, згенерований через API, не враховується.",
      "4. Чисте поповнення = поповнення − виведення. Поповнення включає лише on-chain та C2C; внутрішні перекази не враховуються. Спотовий обсяг = купівля + продаж. Ф’ючерсний обсяг = відкриття + закриття позицій.",
      "5. Винагороди будуть нараховані протягом 10 робочих днів після завершення події. Термін дії ф’ючерсного тестового балансу — 3 дні. Призовий фонд розподіляється за принципом «перший прийшов — перший отримав» до вичерпання. Слідкуйте за балансом. Деталі — в описі та доповненнях до правил.",
      "6. У разі виявлення масових реєстрацій, накрутки обсягів, шахрайства чи інших порушень участь і винагороди буде скасовано.",
      "7. WEEX залишає за собою право змінювати умови, скасовувати, продовжувати, завершувати або призупиняти подію, а також коригувати винагороди без попереднього повідомлення.",
      "8. Усі учасники повинні дотримуватися оновлених умов. WEEX має остаточне право тлумачення. За питаннями звертайтеся до онлайн‑підтримки.",
    ]),
    de_DE: buildIntroHtml([
      "1. Klicken Sie auf „Jetzt anmelden“, um sich zu registrieren und teilzunehmen.",
      "2. Das Event für neue Nutzer gilt nur für Nutzer, die sich während des Event-Zeitraums registrieren. Market Maker und institutionelle Nutzer sind nicht teilnahmeberechtigt und erhalten keine Rewards.",
      "3. Das Event gilt nicht für API-Nutzer; über API generiertes Handelsvolumen wird nicht gezählt.",
      "4. Nettoeinzahlung = Einzahlung − Auszahlung. Einzahlungen umfassen nur On-Chain und C2C; interne Transfers zählen nicht. Spot-Volumen = Kaufvolumen + Verkaufsvolumen. Futures-Volumen = Eröffnungsvolumen + Schließungsvolumen.",
      "5. Rewards werden innerhalb von 10 Werktagen nach Event-Ende verteilt. Futures-Probeguthaben ist 3 Tage gültig. Der Gesamtpool wird nach dem Prinzip „first come, first served“ verteilt, bis er aufgebraucht ist. Bitte achten Sie auf Ihr Guthaben. Details siehe Event-Inhalt und Zusatzregeln.",
      "6. Bei Sammelregistrierungen, Volumenmanipulation, Betrug oder anderen Verstößen werden Teilnahme und Rewards annulliert.",
      "7. WEEX behält sich das Recht vor, Bedingungen jederzeit zu ändern, das Event zu stornieren, zu verlängern, zu beenden oder auszusetzen sowie Rewards anzupassen, ohne vorherige Ankündigung.",
      "8. Alle Teilnehmer müssen die aktualisierten Bedingungen einhalten. WEEX hat das endgültige Auslegungsrecht. Bei Fragen wenden Sie sich an den Online‑Support.",
    ]),
    es_ES: buildIntroHtml([
      "1. Debe hacer clic en [Registrarse ahora] para inscribirse y participar en la actividad.",
      "2. La actividad exclusiva para nuevos usuarios solo aplica a usuarios que se registren durante el periodo de la actividad. Creadores de mercado e instituciones no son elegibles y no recibirán recompensas.",
      "3. Esta actividad no aplica a usuarios de API; el volumen generado por API no se contabiliza.",
      "4. Depósito neto = depósito − retiro. Solo cuentan depósitos on-chain y C2C; las transferencias internas no cuentan. Volumen spot = compras + ventas. Volumen de futuros = aperturas + cierres.",
      "5. Las recompensas se entregarán dentro de 10 días hábiles tras finalizar la actividad. El bono de prueba de futuros es válido por 3 días. El pool total es por orden de llegada hasta agotarse. Revise su saldo. Lea cuidadosamente el contenido y los suplementos de la actividad.",
      "6. Si se detectan registros masivos, manipulación de volumen, trampas u otras infracciones, se cancelará la elegibilidad y las recompensas.",
      "7. WEEX se reserva el derecho de modificar condiciones, cancelar, extender, finalizar o suspender la actividad y ajustar recompensas en cualquier momento sin previo aviso.",
      "8. Todos los participantes deben cumplir los términos revisados. WEEX tiene la interpretación final. Si tiene dudas, contacte al soporte en línea.",
    ]),
    es_419: buildIntroHtml([
      "1. Debes hacer clic en [Registrarse ahora] para inscribirte y participar.",
      "2. La actividad exclusiva para usuarios nuevos aplica solo a quienes se registren durante el periodo del evento. Market makers y usuarios institucionales no pueden participar ni recibir recompensas.",
      "3. No aplica a usuarios de API; el volumen generado por API no cuenta.",
      "4. Depósito neto = depósito − retiro. Solo cuentan depósitos on-chain y C2C; transferencias internas no cuentan. Volumen spot = compra + venta. Volumen de futuros = apertura + cierre.",
      "5. Las recompensas se entregarán dentro de 10 días hábiles después de que termine el evento. El bono de prueba de futuros dura 3 días. El pool total es por orden de llegada hasta agotarse. Revisa tu saldo. Lee el contenido y reglas adicionales del evento.",
      "6. Si se detecta registro masivo, wash trading, trampa u otras infracciones, se cancelará la participación y las recompensas.",
      "7. WEEX puede modificar condiciones, cancelar, extender, terminar o pausar el evento y ajustar recompensas sin aviso previo.",
      "8. Todos deben cumplir los términos revisados. WEEX tiene la interpretación final. Para dudas, contacta a soporte en línea.",
    ]),
    es_AR: buildIntroHtml([
      "1. Debe hacer clic en [Registrarse ahora] para inscribirse y participar en la actividad.",
      "2. La actividad exclusiva para nuevos usuarios solo aplica a usuarios que se registren durante el periodo de la actividad. Creadores de mercado e instituciones no son elegibles.",
      "3. Esta actividad no aplica a usuarios de API; el volumen generado por API no se contabiliza.",
      "4. Depósito neto = depósito − retiro. Solo cuentan depósitos on-chain y C2C; transferencias internas no cuentan. Volumen spot = compras + ventas. Volumen de futuros = aperturas + cierres.",
      "5. Las recompensas se entregarán dentro de 10 días hábiles tras finalizar la actividad. El bono de prueba de futuros es válido por 3 días. El pool total es por orden de llegada hasta agotarse.",
      "6. Si se detectan registros masivos, manipulación de volumen, trampas u otras infracciones, se cancelará la elegibilidad y las recompensas.",
      "7. WEEX se reserva el derecho de modificar condiciones, cancelar, extender, finalizar o suspender la actividad y ajustar recompensas en cualquier momento sin previo aviso.",
      "8. Todos los participantes deben cumplir los términos revisados. WEEX tiene la interpretación final. Si tiene dudas, contacte al soporte en línea.",
    ]),
    fr_FR: buildIntroHtml([
      "1. Cliquez sur [S’inscrire maintenant] pour vous inscrire avant de participer.",
      "2. L’événement réservé aux nouveaux utilisateurs est limité aux utilisateurs qui s’inscrivent pendant la période de l’événement. Les market makers et les utilisateurs institutionnels ne sont pas éligibles et ne recevront pas de récompenses.",
      "3. Cet événement ne s’applique pas aux utilisateurs API ; le volume généré via API ne sera pas comptabilisé.",
      "4. Dépôt net = dépôt − retrait. Les dépôts incluent uniquement les dépôts on-chain et C2C ; les transferts internes ne sont pas comptés. Volume spot = achats + ventes. Volume futures = ouvertures + fermetures.",
      "5. Les récompenses seront distribuées dans les 10 jours ouvrés suivant la fin de l’événement. Les fonds d’essai futures sont valables 3 jours. Le pool total est attribué selon le principe du premier arrivé, premier servi, jusqu’à épuisement. Veuillez surveiller votre solde. Consultez attentivement le contenu et les règles supplémentaires de l’événement.",
      "6. En cas d’inscriptions en masse, de wash trading, de triche ou d’autres violations, l’éligibilité et les récompenses seront annulées.",
      "7. WEEX se réserve le droit de modifier les conditions, d’annuler, de prolonger, de mettre fin ou de suspendre l’événement, et d’ajuster les récompenses à tout moment sans préavis.",
      "8. Tous les participants doivent respecter les conditions révisées. WEEX se réserve l’interprétation finale. En cas de questions, contactez le support en ligne.",
    ]),
    pl_PL: buildIntroHtml([
      "1. Kliknij [Zarejestruj się teraz], aby się zapisać i wziąć udział w wydarzeniu.",
      "2. Wydarzenie dla nowych użytkowników dotyczy wyłącznie użytkowników, którzy zarejestrują się w okresie trwania wydarzenia. Market makerzy i użytkownicy instytucjonalni nie mogą uczestniczyć ani otrzymywać nagród.",
      "3. Wydarzenie nie dotyczy użytkowników API; wolumen wygenerowany przez API nie będzie liczony.",
      "4. Wpłata netto = wpłata − wypłata. Wpłaty obejmują tylko on-chain i C2C; transfery wewnętrzne nie są liczone. Wolumen spot = kupno + sprzedaż. Wolumen futures = otwarcie + zamknięcie.",
      "5. Nagrody zostaną przyznane w ciągu 10 dni roboczych po zakończeniu wydarzenia. Środki próbne futures są ważne 3 dni. Pula nagród jest rozdysponowywana „kto pierwszy, ten lepszy” do wyczerpania. Sprawdź saldo. Zapoznaj się dokładnie z zasadami i dodatkowymi informacjami.",
      "6. W przypadku masowych rejestracji, sztucznego zawyżania wolumenu, oszustw lub innych naruszeń udział i nagrody zostaną anulowane.",
      "7. WEEX zastrzega sobie prawo do zmiany warunków, anulowania, przedłużenia, zakończenia lub zawieszenia wydarzenia oraz dostosowania nagród w dowolnym momencie bez wcześniejszego powiadomienia.",
      "8. Wszyscy uczestnicy muszą przestrzegać zaktualizowanych warunków. WEEX ma ostateczne prawo interpretacji. W razie pytań skontaktuj się z obsługą online.",
    ]),
    pt_PT: buildIntroHtml([
      "1. Clique em [Inscrever-se agora] para se registar antes de participar.",
      "2. O evento exclusivo para novos utilizadores é limitado a utilizadores que se registem durante o período do evento. Market makers e utilizadores institucionais não são elegíveis e não recebem recompensas.",
      "3. Este evento não se aplica a utilizadores de API; o volume gerado via API não será contabilizado.",
      "4. Depósito líquido = depósito − levantamento. Apenas contam depósitos on-chain e C2C; transferências internas não contam. Volume spot = compras + vendas. Volume de futuros = aberturas + fechos.",
      "5. As recompensas serão distribuídas até 10 dias úteis após o fim do evento. O saldo de teste de futuros é válido por 3 dias. O prémio total é por ordem de chegada até esgotar. Verifique o seu saldo. Leia atentamente o conteúdo e as regras adicionais.",
      "6. Se forem detetados registos em massa, wash trading, batota ou outras violações, a elegibilidade e as recompensas serão canceladas.",
      "7. A WEEX reserva-se o direito de alterar condições, cancelar, prolongar, terminar ou suspender o evento e ajustar recompensas a qualquer momento sem aviso prévio.",
      "8. Todos os participantes devem cumprir os termos revistos. A WEEX tem o direito de interpretação final. Em caso de dúvidas, contacte o suporte online.",
    ]),
    pt_BR: buildIntroHtml([
      "1. Clique em [Inscreva-se agora] para se cadastrar antes de participar.",
      "2. O evento exclusivo para novos usuários é válido apenas para quem se registrar durante o período do evento. Market makers e usuários institucionais não são elegíveis e não recebem recompensas.",
      "3. Este evento não se aplica a usuários de API; o volume gerado via API não será contabilizado.",
      "4. Depósito líquido = depósito − saque. Só contam depósitos on-chain e C2C; transferências internas não contam. Volume spot = compra + venda. Volume de futuros = abertura + fechamento.",
      "5. As recompensas serão distribuídas em até 10 dias úteis após o término do evento. O saldo de teste de futuros é válido por 3 dias. O pool total é por ordem de chegada até acabar. Fique atento ao saldo. Leia atentamente o conteúdo e as regras adicionais.",
      "6. Se forem detectados cadastros em massa, manipulação de volume, fraude ou outras violações, a elegibilidade e as recompensas serão canceladas.",
      "7. A WEEX reserva-se o direito de modificar condições, cancelar, estender, encerrar ou suspender o evento e ajustar recompensas a qualquer momento sem aviso prévio.",
      "8. Todos os participantes devem cumprir os termos revisados. A WEEX tem o direito de interpretação final. Em caso de dúvidas, contate o suporte online.",
    ]),
    it_IT: buildIntroHtml([
      "1. Fai clic su [Iscriviti ora] per registrarti prima di partecipare.",
      "2. L’evento esclusivo per i nuovi utenti è riservato a chi si registra durante il periodo dell’evento. Market maker e utenti istituzionali non sono idonei e non riceveranno ricompense.",
      "3. L’evento non è applicabile agli utenti API; il volume generato via API non verrà conteggiato.",
      "4. Deposito netto = deposito − prelievo. I depositi includono solo on-chain e C2C; i trasferimenti interni non contano. Volume spot = acquisti + vendite. Volume futures = aperture + chiusure.",
      "5. Le ricompense saranno distribuite entro 10 giorni lavorativi dalla fine dell’evento. I fondi prova futures sono validi 3 giorni. Il montepremi totale è assegnato in ordine di arrivo fino a esaurimento. Controlla il saldo. Leggi attentamente contenuti e regole aggiuntive dell’evento.",
      "6. In caso di registrazioni di massa, wash trading, cheating o altre violazioni, l’idoneità e le ricompense verranno annullate.",
      "7. WEEX si riserva il diritto di modificare le condizioni, annullare, estendere, terminare o sospendere l’evento e adeguare le ricompense in qualsiasi momento senza preavviso.",
      "8. Tutti i partecipanti devono rispettare i termini aggiornati. WEEX ha il diritto di interpretazione finale. Per domande, contatta l’assistenza online.",
    ]),
    in_ID: buildIntroHtml([
      "1. Klik [Daftar Sekarang] untuk mendaftar sebelum berpartisipasi.",
      "2. Event khusus pengguna baru hanya untuk pengguna yang mendaftar selama periode event. Market maker dan pengguna institusional tidak memenuhi syarat dan tidak dapat menerima hadiah.",
      "3. Event ini tidak berlaku untuk pengguna API; volume trading dari API tidak akan dihitung.",
      "4. Setoran bersih = setoran − penarikan. Setoran hanya mencakup on-chain dan C2C; transfer internal tidak dihitung. Volume spot = beli + jual. Volume futures = buka + tutup posisi.",
      "5. Hadiah akan dibagikan dalam 10 hari kerja setelah event berakhir. Dana trial futures berlaku 3 hari. Total pool hadiah bersifat siapa cepat dia dapat hingga habis. Perhatikan saldo akun. Baca konten dan ketentuan tambahan event dengan saksama.",
      "6. Jika ditemukan pendaftaran massal, manipulasi volume, kecurangan, atau pelanggaran lain, kelayakan dan hadiah akan dibatalkan.",
      "7. WEEX berhak mengubah syarat, membatalkan, memperpanjang, mengakhiri, atau menangguhkan event serta menyesuaikan hadiah kapan saja tanpa pemberitahuan sebelumnya.",
      "8. Semua peserta harus mematuhi ketentuan yang telah direvisi. WEEX memiliki hak interpretasi final. Jika ada pertanyaan, hubungi layanan pelanggan online.",
    ]),
    ja_JP: buildIntroHtml([
      "1. 参加するには、まず［今すぐ登録］をクリックして申請してください。",
      "2. 新規ユーザー限定イベントは、イベント期間中に登録した新規ユーザーのみ対象です。マーケットメーカーおよび機関ユーザーは参加できず、報酬も受け取れません。",
      "3. 本イベントは API ユーザー対象外です。API による取引量は集計されません。",
      "4. 純入金＝入金−出金。入金はオンチェーン入金と C2C のみ対象で、内部振替は対象外です。現物取引量＝買い＋売り。先物（契約）取引量＝建玉＋決済。",
      "5. 報酬はイベント終了後10営業日以内に付与されます。先物トライアル資金の有効期限は3日です。賞金プールは先着順で、なくなり次第終了します。残高をご確認ください。詳細はイベント内容および補足ルールをご確認ください。",
      "6. 大量登録、出来高の不正、チート等の違反が確認された場合、参加資格と報酬は取り消されます。",
      "7. WEEX は事前通知なく条件変更、キャンセル、延長、終了、停止、報酬基準の調整を行う権利を有します。",
      "8. 参加者は改訂後の規約に従う必要があります。WEEX が最終的な解釈権を有します。ご不明点はオンラインサポートまでお問い合わせください。",
    ]),
    ar_AR: buildIntroHtml([
      "1. يجب النقر على [سجّل الآن] لإتمام التسجيل قبل المشاركة في النشاط.",
      "2. نشاط المستخدمين الجدد مخصص فقط للمستخدمين الذين يسجلون خلال فترة النشاط. صناع السوق والمستخدمون المؤسسيون غير مؤهلين ولا يمكنهم الحصول على المكافآت.",
      "3. هذا النشاط لا ينطبق على مستخدمي API؛ لن يتم احتساب حجم التداول الناتج عبر API.",
      "4. صافي الإيداع = الإيداع − السحب. الإيداعات تشمل الإيداع على السلسلة وC2C فقط؛ التحويلات الداخلية لا تُحتسب. حجم التداول الفوري = الشراء + البيع. حجم تداول العقود = فتح الصفقات + إغلاق الصفقات.",
      "5. سيتم توزيع المكافآت خلال 10 أيام عمل بعد انتهاء النشاط. صلاحية رصيد التجربة للعقود 3 أيام. إجمالي جائزة المسبح حسب أسبقية الوصول حتى النفاد. يرجى الانتباه إلى رصيد الحساب وقراءة تفاصيل النشاط والملاحق بعناية.",
      "6. عند اكتشاف تسجيل جماعي أو تضخيم حجم التداول أو غش أو أي مخالفات أخرى، سيتم إلغاء أهلية المشاركة والمكافآت.",
      "7. تحتفظ WEEX بالحق في تعديل شروط النشاط أو إلغائه أو تمديده أو إنهائه أو تعليقه، وكذلك تعديل معايير المكافآت في أي وقت دون إشعار مسبق.",
      "8. يجب على جميع المشاركين الالتزام بالشروط المعدلة، ولـ WEEX حق التفسير النهائي. للاستفسارات يرجى التواصل مع خدمة العملاء عبر الإنترنت.",
    ]),
    fa_IR: buildIntroHtml([
      "1. برای شرکت در رویداد باید روی [ثبت‌نام] کلیک کرده و ثبت‌نام را تکمیل کنید.",
      "2. رویداد ویژه کاربران جدید فقط برای کاربرانی است که در مدت زمان رویداد ثبت‌نام کنند. بازارسازان و کاربران سازمانی واجد شرایط نیستند و پاداش دریافت نمی‌کنند.",
      "3. این رویداد شامل کاربران API نمی‌شود؛ حجم معاملاتی که از طریق API ایجاد شود محاسبه نخواهد شد.",
      "4. واریز خالص = واریز − برداشت. واریز فقط شامل واریز آن‌چین و C2C است؛ انتقال داخلی محاسبه نمی‌شود. حجم اسپات = خرید + فروش. حجم قرارداد = باز کردن + بستن موقعیت.",
      "5. پاداش‌ها ظرف ۱۰ روز کاری پس از پایان رویداد توزیع می‌شوند. اعتبار سرمایه آزمایشی قرارداد ۳ روز است. استخر جوایز به صورت «اولویت با نفرات اول» تا اتمام توزیع می‌شود. لطفاً به موجودی حساب توجه کنید و قوانین و توضیحات تکمیلی را با دقت بخوانید.",
      "6. در صورت شناسایی ثبت‌نام دسته‌جمعی، دستکاری حجم، تقلب یا سایر تخلفات، صلاحیت شرکت و پاداش لغو می‌شود.",
      "7. WEEX حق دارد شرایط رویداد را در هر زمان تغییر دهد، رویداد را لغو/تمدید/پایان/تعلیق کند و استانداردهای پاداش را بدون اطلاع قبلی تنظیم کند.",
      "8. همه شرکت‌کنندگان باید از شرایط اصلاح‌شده پیروی کنند. حق تفسیر نهایی با WEEX است. در صورت سؤال با پشتیبانی آنلاین تماس بگیرید.",
    ]),
    en_TR: buildIntroHtml([
      "1. Click [Register Now] to sign up before participating.",
      "2. The New User exclusive event is limited to users who register during the event period. Market makers and institutional users are not eligible and cannot receive rewards.",
      "3. This event is not applicable to API users; trading volume generated via API will not be counted.",
      "4. Net deposit = deposit − withdrawal. Deposits include on-chain deposits and C2C only; internal transfers are not counted. Spot trading volume = buy volume + sell volume. Futures trading volume = open volume + close volume.",
      "5. Rewards will be distributed within 10 working days after the event ends. Futures trial funds are valid for 3 days. The total prize pool is first-come, first-served; once distributed, it ends.",
      "6. If batch registrations, wash trading, cheating, or other violations are detected, participation eligibility and rewards will be canceled.",
      "7. WEEX reserves the right to modify, cancel, extend, terminate, or suspend the event and adjust reward standards without notice.",
      "8. All participants must comply with the revised terms. WEEX reserves the final right of interpretation. Please contact online customer service if needed.",
    ]),
    tr_CT: buildIntroHtml([
      "1. Etkinliğe katılmak için [Hemen Kaydol] butonuna tıklayıp kayıt olmanız gerekir.",
      "2. Yeni kullanıcı etkinliği yalnızca etkinlik süresince kayıt olan yeni kullanıcılara açıktır. Piyasa yapıcılar ve kurumsal kullanıcılar katılamaz ve ödül alamaz.",
      "3. Bu etkinlik API kullanıcıları için geçerli değildir; API üzerinden oluşan işlem hacmi sayılmaz.",
      "4. Net yatırma = yatırma − çekme. Yatırmalar yalnızca zincir üstü ve C2C yatırmaları kapsar; dahili transferler sayılmaz. Spot hacim = alış + satış. Vadeli işlem hacmi = açılış + kapanış hacmi.",
      "5. Ödüller etkinlik bitiminden sonra 10 iş günü içinde dağıtılacaktır. Vadeli deneme bakiyesi 3 gün geçerlidir. Toplam ödül havuzu ilk gelen alır esasına göre tükenene kadar dağıtılır.",
      "6. Toplu kayıt, hacim şişirme, hile veya diğer ihlaller tespit edilirse katılım ve ödüller iptal edilir.",
      "7. WEEX, koşulları değiştirme, etkinliği iptal etme/uzatma/sonlandırma/durdurma ve ödül standartlarını ayarlama hakkını saklı tutar.",
      "8. Tüm katılımcılar güncellenmiş şartlara uymalıdır. Nihai yorum hakkı WEEX’e aittir. Sorular için çevrimiçi destekle iletişime geçin.",
    ]),
    az_AZ: buildIntroHtml([
      "1. Tədbirdə iştirak etmək üçün əvvəlcə [İndi qeydiyyatdan keç] düyməsinə basaraq qeydiyyatdan keçin.",
      "2. Yeni istifadəçilər üçün xüsusi tədbir yalnız tədbir müddətində qeydiyyatdan keçən yeni istifadəçilərə aiddir. Market-maker və institusional istifadəçilər uyğun deyil və mükafat ala bilməz.",
      "3. Tədbir API istifadəçilərinə şamil edilmir; API vasitəsilə yaranan ticarət həcmi nəzərə alınmayacaq.",
      "4. Xalis depozit = depozit − çıxarış. Depozitlər yalnız on-chain və C2C depozitlərini əhatə edir; daxili köçürmələr sayılmır. Spot həcm = alış + satış. Futures həcm = mövqenin açılması + bağlanması.",
      "5. Mükafatlar tədbir bitdikdən sonra 10 iş günü ərzində paylanacaq. Futures sınaq vəsaiti 3 gün etibarlıdır. Ümumi mükafat fondu “ilk gələn alır” prinsipi ilə tükənənədək paylanır.",
      "6. Kütləvi qeydiyyat, həcm manipulyasiyası, fırıldaq və ya digər pozuntular aşkar edilərsə, iştirak hüququ və mükafatlar ləğv ediləcək.",
      "7. WEEX şərtləri dəyişdirmək, tədbiri ləğv etmək/uzatmaq/bitirmək/dayandırmaq və mükafat standartlarını xəbərdarlıq etmədən tənzimləmək hüququnu özündə saxlayır.",
      "8. Bütün iştirakçılar yenilənmiş şərtlərə əməl etməlidir. Yekun izah hüququ WEEX-ə məxsusdur. Suallar üçün onlayn dəstəyə müraciət edin.",
    ]),
  };

  const title = {
    en_US: "Monopoly World Cup (All Languages)",
    zh_TW: "全語言大富翁世界盃",
    fa_IR: "جام جهانی مونوپولی (چندزبانه)",
    ar_AR: "كأس العالم مونوپولي (متعدد اللغات)",
    ru_RU: "Кубок мира Monopoly (все языки)",
    ko_KR: "전 언어 대富翁 월드컵",
    vi_VN: "Monopoly World Cup (Đa ngôn ngữ)",
    uk_UK: "Monopoly World Cup (усі мови)",
    de_DE: "Monopoly World Cup (Alle Sprachen)",
    es_ES: "Monopoly World Cup (Todos los idiomas)",
    es_419: "Monopoly World Cup (Todos los idiomas)",
    es_AR: "Monopoly World Cup (Todos los idiomas)",
    fr_FR: "Monopoly World Cup (Toutes les langues)",
    pl_PL: "Monopoly World Cup (Wszystkie języki)",
    pt_PT: "Monopoly World Cup (Todos os idiomas)",
    pt_BR: "Monopoly World Cup (Todos os idiomas)",
    it_IT: "Monopoly World Cup (Tutte le lingue)",
    in_ID: "Monopoly World Cup (Semua Bahasa)",
    ja_JP: "モノポリー・ワールドカップ（全言語）",
    en_TR: "Monopoly World Cup (All Languages)",
    tr_CT: "Monopoly Dünya Kupası (Tüm Diller)",
    az_AZ: "Monopoly Dünya Kuboku (Bütün Dillər)",
  };

  const subTitle = {
    en_US: "Accumulate wealth quickly",
    zh_TW: "快速累積財富",
    fa_IR: "سریع ثروت جمع کنید",
    ar_AR: "تراكم الثروة بسرعة",
    ru_RU: "Быстро накапливайте богатство",
    ko_KR: "빠르게 부를 축적하세요",
    vi_VN: "Tích lũy tài sản nhanh chóng",
    uk_UK: "Швидко накопичуйте багатство",
    de_DE: "Schnell Vermögen aufbauen",
    es_ES: "Acumula riqueza rápidamente",
    es_419: "Acumula riqueza rápidamente",
    es_AR: "Acumula riqueza rápidamente",
    fr_FR: "Accumulez rapidement de la richesse",
    pl_PL: "Szybko gromadź majątek",
    pt_PT: "Acumule riqueza rapidamente",
    pt_BR: "Acumule riqueza rapidamente",
    it_IT: "Accumula ricchezza rapidamente",
    in_ID: "Kumpulkan kekayaan dengan cepat",
    ja_JP: "素早く資産を増やそう",
    en_TR: "Accumulate wealth quickly",
    tr_CT: "Hızlıca servet biriktirin",
    az_AZ: "Sərvəti sürətlə toplayın",
  };

  const myShareContent = {
    en_US: "My Wealth",
    zh_TW: "我的財富",
    fa_IR: "ثروت من",
    ar_AR: "ثروتي",
    ru_RU: "Моё богатство",
    ko_KR: "내 부",
    vi_VN: "Tài sản của tôi",
    uk_UK: "Моє багатство",
    de_DE: "Mein Vermögen",
    es_ES: "Mi riqueza",
    es_419: "Mi riqueza",
    es_AR: "Mi riqueza",
    fr_FR: "Ma richesse",
    pl_PL: "Moje bogactwo",
    pt_PT: "A minha riqueza",
    pt_BR: "Minha riqueza",
    it_IT: "La mia ricchezza",
    in_ID: "Kekayaanku",
    ja_JP: "私の資産",
    en_TR: "My Wealth",
    tr_CT: "Servetim",
    az_AZ: "Sərvətim",
  };

  const shareContent = {
    en_US: zhShareContent || "World Cup × Monopoly: Win 1,000,000 USDT",
    zh_TW: "世界盃 × 大富翁：贏取 1,000,000 USDT",
    fa_IR: "جام جهانی × مونوپولی: برنده 1,000,000 USDT شوید",
    ar_AR: "كأس العالم × مونوپولي: اربح 1,000,000 USDT",
    ru_RU: "Кубок мира × Monopoly: выиграйте 1 000 000 USDT",
    ko_KR: "월드컵 × 대富翁: 1,000,000 USDT를 획득하세요",
    vi_VN: "World Cup × Monopoly: Nhận 1.000.000 USDT",
    uk_UK: "Кубок світу × Monopoly: виграйте 1 000 000 USDT",
    de_DE: "World Cup × Monopoly: Gewinne 1.000.000 USDT",
    es_ES: "World Cup × Monopoly: Gana 1.000.000 USDT",
    es_419: "World Cup × Monopoly: Gana 1,000,000 USDT",
    es_AR: "World Cup × Monopoly: Gana 1.000.000 USDT",
    fr_FR: "World Cup × Monopoly : Gagnez 1 000 000 USDT",
    pl_PL: "World Cup × Monopoly: Wygraj 1 000 000 USDT",
    pt_PT: "World Cup × Monopoly: Ganhe 1 000 000 USDT",
    pt_BR: "World Cup × Monopoly: Ganhe 1.000.000 USDT",
    it_IT: "World Cup × Monopoly: Vinci 1.000.000 USDT",
    in_ID: "World Cup × Monopoly: Menangkan 1.000.000 USDT",
    ja_JP: "ワールドカップ × モノポリー：1,000,000 USDT を獲得",
    en_TR: zhShareContent || "World Cup × Monopoly: Win 1,000,000 USDT",
    tr_CT: "Dünya Kupası × Monopoly: 1.000.000 USDT kazanın",
    az_AZ: "Dünya Kuboku × Monopoly: 1 000 000 USDT qazanın",
  };

  const agentShareContent = {
    en_US: "World Cup Channel",
    zh_TW: "世界盃渠道",
    fa_IR: "کانال جام جهانی",
    ar_AR: "قناة كأس العالم",
    ru_RU: "Канал Кубка мира",
    ko_KR: "월드컵 채널",
    vi_VN: "Kênh World Cup",
    uk_UK: "Канал Кубка світу",
    de_DE: "World-Cup-Kanal",
    es_ES: "Canal del Mundial",
    es_419: "Canal del Mundial",
    es_AR: "Canal del Mundial",
    fr_FR: "Canal Coupe du monde",
    pl_PL: "Kanał World Cup",
    pt_PT: "Canal do Mundial",
    pt_BR: "Canal da Copa do Mundo",
    it_IT: "Canale Mondiale",
    in_ID: "Kanal Piala Dunia",
    ja_JP: "ワールドカップ・チャンネル",
    en_TR: "World Cup Channel",
    tr_CT: "Dünya Kupası Kanalı",
    az_AZ: "Dünya Kuboku Kanalı",
  };

  return { intro, title, subTitle, myShareContent, shareContent, agentShareContent, fallbackLang: "en_US" };
}

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function buildUpdatePayload(detail) {
  return {
    activityId: detail.activityId,
    activityOwner: detail.activityOwner,
    configType: detail.configType,
    channelCategory: detail.channelCategory,
    guideTemplateId: detail.guideTemplateId,
    startTime: detail.startTime,
    endTime: detail.endTime,
    showUrl: detail.showUrl,
    applyConfigId: detail.applyConfigId,
    expanded: detail.expanded,
    showActivityCalendar: detail.showActivityCalendar,
    periodValidity: detail.periodValidity ?? null,
    periods: detail.periods ?? 0,
    syncCalendarFlag: detail.syncCalendarFlag ?? 0,
    syncCalendarDto: detail.syncCalendarDto ?? null,
    title: detail.title,
    subTitle: detail.subTitle,
    intro: detail.intro,
    shareContent: detail.shareContent,
    agentShareContent: detail.agentShareContent,
    type: detail.type,
    activityType: detail.activityType,
    contractTradingVolumeTaskId: detail.contractTradingVolumeTaskId ?? null,
    activityConfigI18n: detail.activityConfigI18n,
    monopolyList: detail.monopolyList,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const session = await createAdminApiSession({ config, requireApiLogin: true });

  try {
    const detail = await getActivityDetail(session, args.activityId);
    const i18n = Array.isArray(detail?.activityConfigI18n) ? detail.activityConfigI18n : [];
    const zh = i18n.find(r => String(r?.lang || "").toLowerCase() === "zh_cn");
    if (!zh) throw new Error("zh_CN record not found in activityConfigI18n");

    const translations = buildTranslationsFromZh({
      zhTitle: pickText(zh, "title"),
      zhSubTitle: pickText(zh, "subTitle"),
      zhMyShareContent: pickText(zh, "myShareContent"),
      zhShareContent: pickText(zh, "shareContent"),
      zhAgentShareContent: pickText(zh, "agentShareContent"),
      zhIntroHtml: pickText(zh, "intro"),
    });

    const beforeMissing = {};
    for (const rec of i18n) {
      const lang = String(rec?.lang || "");
      beforeMissing[lang] = Object.fromEntries(FIELDS.map(f => [f, nonEmpty(rec?.[f])]));
    }

    const nextI18n = i18n.map(rec => {
      const lang = String(rec?.lang || "");
      if (!lang) return rec;
      if (lang.toLowerCase() === "zh_cn") return rec;
      const baseLang = translations.fallbackLang;
      const t = {
        title: translations.title[lang] || translations.title[baseLang] || pickText(zh, "title") || "",
        subTitle: translations.subTitle[lang] || translations.subTitle[baseLang] || pickText(zh, "subTitle") || "",
        myShareContent: translations.myShareContent[lang] || translations.myShareContent[baseLang] || pickText(zh, "myShareContent") || "",
        shareContent: translations.shareContent[lang] || translations.shareContent[baseLang] || pickText(zh, "shareContent") || "",
        agentShareContent: translations.agentShareContent[lang] || translations.agentShareContent[baseLang] || pickText(zh, "agentShareContent") || "",
        intro: translations.intro[lang] || translations.intro[baseLang] || pickText(zh, "intro") || "",
      };
      let out = { ...rec };
      for (const field of FIELDS) {
        out = applyText(out, field, t[field], { overwrite: args.overwrite });
      }
      return out;
    });

    const nextDetail = { ...detail, activityConfigI18n: nextI18n };

    const afterMissing = {};
    for (const rec of nextI18n) {
      const lang = String(rec?.lang || "");
      afterMissing[lang] = Object.fromEntries(FIELDS.map(f => [f, nonEmpty(rec?.[f])]));
    }

    const plan = {
      ok: true,
      dryRun: args.dryRun,
      activityId: detail.activityId,
      showUrl: detail.showUrl,
      type: detail.type,
      i18nCount: nextI18n.length,
      overwrite: args.overwrite,
      beforeMissing,
      afterMissing,
    };

    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    await updateActivity(session, buildUpdatePayload(nextDetail));
    const verify = await getActivityDetail(session, args.activityId);
    const verifyI18n = Array.isArray(verify?.activityConfigI18n) ? verify.activityConfigI18n : [];
    const missing = [];
    for (const rec of verifyI18n) {
      const lang = String(rec?.lang || "");
      if (!lang) continue;
      for (const f of FIELDS) {
        if (!nonEmpty(rec?.[f])) missing.push({ lang, field: f });
      }
    }
    if (missing.length) throw new Error(`verify failed: still missing fields: ${JSON.stringify(missing.slice(0, 20))}${missing.length > 20 ? ` ...(${missing.length})` : ""}`);

    printJson({ ...plan, saved: true });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

