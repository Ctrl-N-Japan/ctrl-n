// Paste into a new project at script.google.com and run createProfileForm once.
function createProfileForm() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) throw new Error('Already created. Check the execution log or Script Properties.');
  const form = FormApp.create('Ctrl-N メンバープロフィール');
  props.setProperty('FORM_ID', form.getId());
  form.setDescription('メンバー紹介に掲載するプロフィールと作品を入力してください。内容確認後に掲載します。');
  form.setAllowResponseEdits(true);
  form.addTextItem().setTitle('GitHubユーザー名').setHelpText('例: hrmcngs。URLではなくユーザー名のみ。').setRequired(true);
  form.addTextItem().setTitle('表示名').setRequired(true);
  form.addParagraphTextItem().setTitle('自己紹介').setHelpText('200文字程度で、活動内容や好きなことを紹介してください。').setRequired(true);
  form.addTextItem().setTitle('得意なこと').setHelpText('例: Programming, 3D Modeling, Design');
  form.addTextItem().setTitle('作品タイトル');
  form.addParagraphTextItem().setTitle('作品の説明').setHelpText('画像に何が写っているか、工夫した点など。');
  form.addTextItem().setTitle('作品URL').setHelpText('https:// から始まる公開URL（任意）。');
  form.addTextItem().setTitle('テーマ名').setHelpText('例: tokyonight / spring / auto。空欄は既存設定を使います。');
  form.addCheckboxItem().setTitle('掲載への同意').setChoiceValues(['プロフィールと添付画像をWebサイトで公開することに同意します']).setRequired(true);
  const sheet = SpreadsheetApp.create('Ctrl-N プロフィール回答（非公開）');
  props.setProperty('SHEET_ID', sheet.getId());
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  form.setConfirmationMessage('回答を受け付けました。確認後にサイトへ反映します。');
  console.log('フォーム編集: ' + form.getEditUrl());
  console.log('回答用URL: ' + form.getPublishedUrl());
  console.log('回答シート: ' + sheet.getUrl());
  console.log('次にフォーム編集画面で「作品画像」というファイルアップロード質問を追加してください。');
}

// Run after reviewing responses. Only rows marked 掲載OK=TRUE are exported.
function exportApprovedProfiles() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run createProfileForm first.');
  const sheets = SpreadsheetApp.openById(id).getSheets();
  const sheet = sheets.find(s => s.getLastColumn() && s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].includes('GitHubユーザー名'));
  if (!sheet) throw new Error('フォームにテスト回答を送信してから実行してください。');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  if (!headers.includes('掲載OK')) {
    const column = headers.length + 1;
    sheet.getRange(1, column).setValue('掲載OK');
    if (sheet.getLastRow() > 1) sheet.getRange(2, column, sheet.getLastRow() - 1).insertCheckboxes();
    throw new Error('掲載OK列を追加しました。掲載する行をチェックして再実行してください。');
  }
  const get = (row, name) => row[headers.indexOf(name)] || '';
  const profiles = [];
  for (const row of rows) {
    if (get(row, '掲載OK') !== true || !get(row, '掲載への同意')) continue;
    const profile = {
      login: String(get(row, 'GitHubユーザー名')).trim(),
      displayName: String(get(row, '表示名')),
      bio: String(get(row, '自己紹介')),
      skills: String(get(row, '得意なこと')).split(/[,、]/).map(s => s.trim()).filter(Boolean),
      theme: String(get(row, 'テーマ名')).trim(),
      work: { title: String(get(row, '作品タイトル')), description: String(get(row, '作品の説明')), url: String(get(row, '作品URL')).trim() },
      images: []
    };
    const links = String(get(row, '作品画像')).split(/,\s*/).filter(Boolean);
    for (const link of links.slice(0, 3)) {
      const match = link.match(/[?&]id=([\w-]+)/) || link.match(/\/d\/([\w-]+)/);
      if (!match) throw new Error('画像リンクを確認してください: ' + profile.login);
      const blob = DriveApp.getFileById(match[1]).getBlob();
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.getContentType())) throw new Error('PNG/JPEG/WebPのみ対応: ' + profile.login);
      const bytes = blob.getBytes();
      if (bytes.length > 5 * 1024 * 1024) throw new Error('画像は1枚5MB以下: ' + profile.login);
      profile.images.push({ type: blob.getContentType(), data: Utilities.base64Encode(bytes) });
    }
    profiles.push(profile);
  }
  const json = JSON.stringify({ profiles }, null, 2);
  const file = DriveApp.createFile('ctrl-n-approved-profiles.json', json, MimeType.PLAIN_TEXT);
  console.log('非公開の書き出しファイル（ダウンロードしてください）: ' + file.getUrl());
}
