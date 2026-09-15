const tls = require('tls');
const net = require('net');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'email_config.json');

/**
 * 저장된 이메일 발송 설정 불러오기
 */
function getEmailConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.warn('[Email Config Load Error]', err.message);
  }
  return {
    provider: 'naver',
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    senderName: '(주)리본케어 삼성화재 운영데스크',
    senderEmail: '',
    user: '',
    pass: ''
  };
}

/**
 * 이메일 발송 설정 영구 저장
 */
function saveEmailConfig(cfg) {
  try {
    const existing = getEmailConfig();
    const merged = { ...existing, ...cfg, updatedAt: new Date().toISOString() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    console.log('[Email Config Saved]', Object.keys(merged));
    return merged;
  } catch (err) {
    console.error('[Email Config Save Error]', err.message);
    return cfg;
  }
}

/**
 * 한글 헤더(제목, 발신자명 등)를 MIME B-encoding (UTF-8 Base64)으로 변환
 */
function encodeMimeHeader(str) {
  if (!str) return '';
  if (/[\u0080-\uFFFF]/.test(str)) {
    return `=?UTF-8?B?${Buffer.from(str, 'utf-8').toString('base64')}?=`;
  }
  return str;
}

/**
 * 이메일 주소 목록(콤마 구분 또는 배열) 파싱 및 정리
 */
function parseEmailList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  return String(input).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

/**
 * 수신자/발신자 문자열에서 순수 이메일 주소만 엄격 추출 (RFC 5321 규격)
 */
function extractCleanEmail(input) {
  if (!input) return '';
  const str = String(input).trim();
  const angleMatch = str.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().replace(/^[<>\s]+|[<>\s]+$/g, '');
  const emailMatch = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].trim();
  return str.replace(/^[<>\s]+|[<>\s]+$/g, '');
}

/**
 * 발신자 정보(순수 이메일 주소 및 표시명) 파싱 및 정규화
 * - envelope sender (MAIL FROM:<...>)는 반드시 RFC 5321 순수 이메일 주소여야 함
 * - display name은 RFC 5322 MIME 헤더 (From: ...)에 인코딩되어 노출됨
 */
function parseSenderInfo(from, senderName, user, host = '') {
  let resolvedDisplayName = (senderName || '').trim();
  let candidateEmail = '';

  const rawFrom = (from || '').trim();

  // 1. "홍길동 <email@domain.com>" 또는 "<email@domain.com>" 형식 추출
  const angleMatch = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (angleMatch) {
    if (angleMatch[1].trim() && !resolvedDisplayName) {
      resolvedDisplayName = angleMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    candidateEmail = angleMatch[2].trim();
  } else if (rawFrom.includes('@')) {
    const emailMatch = rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      candidateEmail = emailMatch[1].trim();
      const prefix = rawFrom.replace(emailMatch[0], '').replace(/[<>\(\)\[\]"']/g, '').trim();
      if (prefix && !resolvedDisplayName) {
        resolvedDisplayName = prefix;
      }
    } else {
      candidateEmail = rawFrom;
    }
  } else if (rawFrom) {
    // '@'가 없는 한글/문자열 표시명만 들어온 경우 (예: "(주)리본케어_김지훈")
    if (!resolvedDisplayName) {
      resolvedDisplayName = rawFrom;
    }
    candidateEmail = '';
  }

  // 2. candidateEmail이 비어있으면 user(인증 계정) 기반 대체
  let cleanEmail = extractCleanEmail(candidateEmail);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    if (user && user.includes('@')) {
      cleanEmail = extractCleanEmail(user);
    } else if (user) {
      const trimmedUser = String(user).trim();
      if (host.includes('naver.com')) {
        cleanEmail = `${trimmedUser}@naver.com`;
      } else if (host.includes('daum.net') || host.includes('hanmail.net') || host.includes('kakao.com')) {
        cleanEmail = `${trimmedUser}@daum.net`;
      } else if (host.includes('gmail.com')) {
        cleanEmail = `${trimmedUser}@gmail.com`;
      } else {
        cleanEmail = trimmedUser;
      }
    }
  }

  // 불필요한 따옴표나 괄호 정리
  resolvedDisplayName = resolvedDisplayName.replace(/<[^>]+>/g, '').replace(/^["']|["']$/g, '').trim();
  if (!resolvedDisplayName) {
    resolvedDisplayName = cleanEmail;
  }

  return {
    cleanEmail,
    displayName: resolvedDisplayName
  };
}

/**
 * 순수 Node.js tls/net 기반 SMTP 메일 발송 엔진
 */
function sendSmtpMail(options) {
  return new Promise((resolve, reject) => {
    const {
      host = 'smtp.naver.com',
      port = 465,
      secure = true,
      user,
      pass,
      from,
      senderName,
      to,
      cc,
      bcc,
      subject = '(제목 없음)',
      text = '',
      html = '',
      attachments = []
    } = options;

    if (!host) return reject(new Error('SMTP 호스트가 설정되지 않았습니다.'));
    if (!user || !pass) return reject(new Error('SMTP 계정 아이디 또는 비밀번호가 설정되지 않았습니다.'));

    const toList = parseEmailList(to);
    const ccList = parseEmailList(cc);
    const bccList = parseEmailList(bcc);
    const allRecipients = [...toList, ...ccList, ...bccList];

    if (allRecipients.length === 0) {
      return reject(new Error('수신자 이메일 주소(To)가 지정되지 않았습니다.'));
    }

    const { cleanEmail: senderEmail, displayName } = parseSenderInfo(from, senderName, user, host);

    console.log('[sendSmtpMail Start]', {
      host, port, secure,
      envelopeFrom: senderEmail,
      displayName,
      toList,
      ccList,
      bccList,
      subject,
      attachmentCount: attachments.length
    });

    let socket;
    let step = 0;
    let buffer = '';
    let timeoutTimer = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (socket && !socket.destroyed) {
        try { socket.end(); } catch (e) {}
      }
    };

    const fail = (err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const sendCmd = (cmd) => {
      if (socket && !socket.destroyed) {
        socket.write(cmd + '\r\n');
      }
    };

    timeoutTimer = setTimeout(() => {
      fail(new Error(`SMTP 서버(${host}:${port}) 응답 시간 초과 (30초 타임아웃)`));
    }, 30000);

    const onConnected = () => {
      console.log(`[SMTP Connected] ${host}:${port} (secure: ${secure})`);
    };

    // Socket Connection Setup
    if (secure || port === 465) {
      socket = tls.connect(port, host, { rejectUnauthorized: false }, onConnected);
    } else {
      socket = net.connect(port, host, onConnected);
    }

    socket.setEncoding('utf-8');

    socket.on('error', (err) => {
      console.error('[SMTP Socket Error]', err);
      fail(new Error(`SMTP 서버 연결 실패: ${err.message}`));
    });

    socket.on('close', () => {
      if (step < 8) {
        fail(new Error('SMTP 서버와의 연결이 예기치 않게 종료되었습니다.'));
      }
    });

    socket.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        console.log('[SMTP IN]', line);

        const isLastLineOfReply = /^\d{3}\s/.test(line);
        const code = parseInt(line.substring(0, 3), 10);

        if (!isLastLineOfReply) continue;

        try {
          if (step === 0) {
            // Welcome greeting (220 ...)
            if (code !== 220) return fail(new Error(`SMTP 초기 응답 오류: ${line}`));
            step = 1;
            sendCmd(`EHLO ${socket.localAddress || 'localhost'}`);
          } else if (step === 1) {
            // EHLO response (250 ...)
            if (code !== 250) return fail(new Error(`EHLO 실패: ${line}`));

            // Check if STARTTLS needed for port 587
            if (!secure && port !== 465 && line.includes('STARTTLS')) {
              step = 100;
              sendCmd('STARTTLS');
              return;
            }

            step = 2;
            sendCmd('AUTH LOGIN');
          } else if (step === 100) {
            if (code !== 220) return fail(new Error(`STARTTLS 전환 실패: ${line}`));
            socket = tls.connect({ socket, rejectUnauthorized: false }, () => {
              step = 1;
              sendCmd(`EHLO ${socket.localAddress || 'localhost'}`);
            });
            socket.setEncoding('utf-8');
            return;
          } else if (step === 2) {
            if (code !== 334) {
              return fail(new Error(`SMTP AUTH LOGIN 거부 (서버 응답: ${line}). 아이디/비밀번호 설정을 확인해주세요.`));
            }
            step = 3;
            sendCmd(Buffer.from(user).toString('base64'));
          } else if (step === 3) {
            if (code !== 334) {
              return fail(new Error(`SMTP 사용자명 인증 실패 (서버 응답: ${line}). 메일 계정 아이디를 확인해주세요.`));
            }
            step = 4;
            sendCmd(Buffer.from(pass).toString('base64'));
          } else if (step === 4) {
            if (code !== 235) {
              return fail(new Error(`SMTP 비밀번호 인증 실패: 계정 아이디 또는 비밀번호(앱 비밀번호)를 확인해주세요. (서버 응답: ${line})`));
            }
            step = 5;
            sendCmd(`MAIL FROM:<${senderEmail}>`);
          } else if (step === 5) {
            if (code !== 250) {
              return fail(new Error(`발신자 주소 거부: <${senderEmail}> (서버 응답: ${line})`));
            }
            step = 6;
            sendRecipients(allRecipients, 0);
          } else if (step === 6) {
            // Handled in sendRecipients
          } else if (step === 7) {
            if (code !== 354) {
              return fail(new Error(`DATA 명령 거부 (서버 응답: ${line})`));
            }
            step = 8;
            const rawMessage = buildMimeMessage({
              senderName: displayName,
              senderEmail,
              toList,
              ccList,
              subject,
              text,
              html,
              attachments
            });
            socket.write(rawMessage + '\r\n.\r\n');
          } else if (step === 8) {
            if (code !== 250) {
              return fail(new Error(`메일 전송 실패 (서버 응답: ${line})`));
            }
            step = 9;
            sendCmd('QUIT');
            cleanup();
            resolve({
              success: true,
              message: '이메일이 SMTP 서버를 통해 성공적으로 발송되었습니다.',
              serverReply: line,
              recipients: allRecipients,
              sentAt: new Date().toISOString()
            });
          }
        } catch (err) {
          fail(err);
        }
      }
    });

    function sendRecipients(list, idx) {
      if (idx >= list.length) {
        step = 7;
        sendCmd('DATA');
        return;
      }
      const rcpt = list[idx];
      const cleanEmail = extractCleanEmail(rcpt);

      sendCmd(`RCPT TO:<${cleanEmail}>`);

      const onRcptData = (chunk) => {
        const rcptLine = chunk.toString().trim();
        const rcptCode = parseInt(rcptLine.substring(0, 3), 10);
        if (rcptCode === 250 || rcptCode === 251) {
          socket.removeListener('data', onRcptData);
          sendRecipients(list, idx + 1);
        } else {
          socket.removeListener('data', onRcptData);
          fail(new Error(`수신자 주소 거부: <${cleanEmail}> (서버 응답: ${rcptLine})`));
        }
      };
      socket.once('data', onRcptData);
    }
  });
}

function buildMimeMessage({ senderName, senderEmail, toList, ccList, subject, text, html, attachments }) {
  const boundaryMixed = '----=_Part_Mixed_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  const boundaryAlt = '----=_Part_Alt_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  const nowStr = new Date().toUTCString();

  const formattedFrom = (senderName && senderName !== senderEmail)
    ? `${encodeMimeHeader(senderName)} <${senderEmail}>`
    : `<${senderEmail}>`;

  const formattedTo = toList.map(t => {
    const m = t.match(/^(.*?)\s*<([^>]+)>$/);
    return m ? `${encodeMimeHeader(m[1].trim())} <${extractCleanEmail(m[2])}>` : `<${extractCleanEmail(t)}>`;
  }).join(', ');

  const formattedCc = (ccList || []).map(t => {
    const m = t.match(/^(.*?)\s*<([^>]+)>$/);
    return m ? `${encodeMimeHeader(m[1].trim())} <${extractCleanEmail(m[2])}>` : `<${extractCleanEmail(t)}>`;
  }).join(', ');

  const headers = [
    `From: ${formattedFrom}`,
    `To: ${formattedTo}`,
    (ccList && ccList.length > 0) ? `Cc: ${formattedCc}` : null,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Date: ${nowStr}`,
    `MIME-Version: 1.0`,
    `X-Mailer: LivonMate Care ERP Email System 3.0`
  ].filter(Boolean);

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
  }

  let body = headers.join('\r\n') + '\r\n\r\n';

  if (hasAttachments) {
    body += `--${boundaryMixed}\r\n`;
    body += `Content-Type: multipart/alternative; boundary="${boundaryAlt}"\r\n\r\n`;
  }

  const plainText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
  body += `--${boundaryAlt}\r\n`;
  body += `Content-Type: text/plain; charset=UTF-8\r\n`;
  body += `Content-Transfer-Encoding: base64\r\n\r\n`;
  body += Buffer.from(plainText, 'utf-8').toString('base64') + '\r\n\r\n';

  if (html) {
    body += `--${boundaryAlt}\r\n`;
    body += `Content-Type: text/html; charset=UTF-8\r\n`;
    body += `Content-Transfer-Encoding: base64\r\n\r\n`;
    body += Buffer.from(html, 'utf-8').toString('base64') + '\r\n\r\n';
  }

  body += `--${boundaryAlt}--\r\n`;

  if (hasAttachments) {
    for (const att of attachments) {
      const filename = att.filename || 'attachment.dat';
      const encodedFilename = encodeMimeHeader(filename);
      const mimeType = att.contentType || 'application/octet-stream';
      let contentBase64 = '';

      if (Buffer.isBuffer(att.content)) {
        contentBase64 = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        if (att.encoding === 'base64') {
          contentBase64 = att.content;
        } else {
          contentBase64 = Buffer.from(att.content, 'utf-8').toString('base64');
        }
      } else if (att.path && fs.existsSync(att.path)) {
        contentBase64 = fs.readFileSync(att.path).toString('base64');
      }

      body += `\r\n--${boundaryMixed}\r\n`;
      body += `Content-Type: ${mimeType}; name="${encodedFilename}"\r\n`;
      body += `Content-Disposition: attachment; filename="${encodedFilename}"\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      const chunked = contentBase64.match(/.{1,76}/g)?.join('\r\n') || contentBase64;
      body += chunked + '\r\n';
    }
    body += `\r\n--${boundaryMixed}--\r\n`;
  }

  return body;
}

async function testSmtpConnection(options) {
  const { host, port, secure, user, pass, testTo } = options;
  const targetEmail = testTo || user;

  const testSubject = `[리본케어] SMTP 이메일 발송 연동 테스트 (${new Date().toLocaleTimeString('ko-KR')})`;
  const testHtml = `
    <div style="font-family: 'Pretendard', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%); padding: 20px; border-radius: 12px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800;">🎉 SMTP 발송 연동 테스트 성공!</h2>
        <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">리본케어 통합 간병 ERP 시스템</p>
      </div>
      <div style="padding: 20px 0; color: #334155; font-size: 14px; line-height: 1.6;">
        <p>안녕하세요. 리본케어 전산시스템에서 발송된 <b>SMTP 실제 연동 확인 메일</b>입니다.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; width: 120px; color: #475569;">SMTP 호스트</td>
            <td style="padding: 10px; color: #0f172a;">${host}:${port} (${secure ? 'SSL/TLS' : 'STARTTLS'})</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; color: #475569;">발신 계정</td>
            <td style="padding: 10px; color: #0f172a;">${user}</td>
          </tr>
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; color: #475569;">수신 테스트</td>
            <td style="padding: 10px; color: #0f172a;">${targetEmail}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #475569;">테스트 일시</td>
            <td style="padding: 10px; color: #0f172a;">${new Date().toLocaleString('ko-KR')}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
          ✅ 이제 <b>삼성화재 일일 접수 보고, 간병일지 전송, 월간 정기 청구서</b>가 지정된 수신처로 실제 즉시 발송됩니다.
        </div>
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
        본 메일은 리본케어 전산시스템의 SMTP 설정 검증을 위해 자동 발송되었습니다.
      </div>
    </div>
  `;

  return await sendSmtpMail({
    host,
    port,
    secure,
    user,
    pass,
    from: options.from || user,
    senderName: options.senderName || '(주)리본케어 운영데스크',
    to: targetEmail,
    subject: testSubject,
    html: testHtml
  });
}

module.exports = {
  getEmailConfig,
  saveEmailConfig,
  sendSmtpMail,
  testSmtpConnection
};
