# Supabase 메일 템플릿 (Authentication → Emails → Templates)

커스텀 SMTP(hello.knock.team@gmail.com)를 켠 뒤에만 수정할 수 있다.
사이트는 메일 속 6자리 코드를 입력받는다. 버튼(링크)도 같이 둬서 어느 쪽으로든 된다.

## Reset Password

제목:

```
[knock] 비밀번호 코드 {{ .Token }}
```

본문:

```html
<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:440px;margin:0 auto;padding:32px 24px;color:#121318">
  <p style="font-size:20px;font-weight:800;margin:0 0 24px">knock</p>
  <p style="font-size:16px;line-height:1.6;margin:0 0 20px">비밀번호를 새로 만드는 코드예요. 사이트 화면에 그대로 넣어주세요.</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 20px;padding:18px 0;text-align:center;background:#F5F6F2;border-radius:12px">{{ .Token }}</p>
  <p style="font-size:14px;line-height:1.6;color:#5C5F6B;margin:0 0 24px">코드는 1시간 동안 쓸 수 있어요. 코드 대신 아래 버튼을 눌러도 돼요.</p>
  <p style="margin:0 0 28px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#121318;color:#fff;text-decoration:none;font-weight:700;font-size:15px">비밀번호 새로 만들기</a></p>
  <p style="font-size:12px;line-height:1.6;color:#8A8D96;margin:0">직접 요청하지 않았다면 이 메일은 무시해도 돼요. 비밀번호는 바뀌지 않아요.</p>
</div>
```

## Confirm signup

제목:

```
[knock] 가입 코드 {{ .Token }}
```

본문:

```html
<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:440px;margin:0 auto;padding:32px 24px;color:#121318">
  <p style="font-size:20px;font-weight:800;margin:0 0 24px">knock</p>
  <p style="font-size:16px;line-height:1.6;margin:0 0 20px">똑똑, 가입을 마치는 코드예요. 사이트 화면에 그대로 넣어주세요.</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 20px;padding:18px 0;text-align:center;background:#F5F6F2;border-radius:12px">{{ .Token }}</p>
  <p style="font-size:14px;line-height:1.6;color:#5C5F6B;margin:0 0 24px">코드 대신 아래 버튼을 눌러도 돼요.</p>
  <p style="margin:0 0 28px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#121318;color:#fff;text-decoration:none;font-weight:700;font-size:15px">가입 마치기</a></p>
  <p style="font-size:12px;line-height:1.6;color:#8A8D96;margin:0">직접 가입하지 않았다면 이 메일은 무시해도 돼요.</p>
</div>
```
