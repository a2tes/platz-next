# AWS Video Processing Pipeline — Kurulum Rehberi

Bu rehber, Platz projesinin AWS altyapısını sıfırdan kurmak için gereken tüm adımları içerir.

---

## Genel Bakış

```
Video Upload → S3 Bucket → API (MediaConvert Job) → MediaConvert
                                                          ↓
DB Update ← API Webhook ← SNS ← EventBridge ← MediaConvert (COMPLETE)
```

**Bileşenler:**

- **S3 Bucket** — Video/image/document depolama
- **CloudFront** — CDN (S3 önünde)
- **MediaConvert** — Video dönüştürme (1080p/720p/480p MP4 + HLS)
- **EventBridge** — MediaConvert iş durumu değişikliklerini yakalar
- **SNS** — EventBridge olaylarını API webhook'una iletir
- **Lambda** _(opsiyonel)_ — S3'e yüklenen videoları otomatik işler

---

## 1. AWS CLI Yapılandırması (Bilgisayarınızda)

### 1.1 AWS CLI Kurulumu

```bash
# macOS
brew install awscli

# Ubuntu
sudo apt install awscli
```

### 1.2 Profil Oluşturma

```bash
aws configure --profile platz
```

Sorulacak bilgiler:

```
AWS Access Key ID: <IAM kullanıcınızın access key'i>
AWS Secret Access Key: <IAM kullanıcınızın secret key'i>
Default region name: eu-central-1
Default output format: json
```

> **Not:** IAM kullanıcısının aşağıdaki izinlere ihtiyacı var:
>
> - `AmazonS3FullAccess`
> - `AWSElementalMediaConvertFullAccess`
> - `AmazonSNSFullAccess`
> - `AmazonEventBridgeFullAccess`
> - `CloudFrontFullAccess`
> - `IAMFullAccess` (role oluşturmak için)

### 1.3 Profili Test Etme

```bash
aws sts get-caller-identity --profile platz
```

Account ID'yi not edin — ileride lazım olacak.

---

## 2. S3 Bucket Oluşturma

### 2.1 Bucket Oluştur

```bash
aws s3 mb s3://platz-prod --region eu-central-1 --profile platz
```

### 2.2 Public Access'i Kapat

```bash
aws s3api put-public-access-block \
  --bucket platz-prod \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --profile platz
```

### 2.3 CORS Yapılandırması

```bash
aws s3api put-bucket-cors --bucket platz-prod --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedOrigins": [
        "https://admin.yourdomain.com",
        "https://yourdomain.com",
        "http://localhost:3000",
        "http://localhost:3001"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}' --profile platz
```

---

## 3. CloudFront Dağıtımı Oluşturma

### 3.1 Origin Access Control (OAC) Oluştur

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "platz-s3-oac",
    "Description": "OAC for platz S3 bucket",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }' --profile platz
```

Çıktıdaki `Id` değerini not edin (ör: `E2QWRUHAPOMQZL`).

### 3.2 CloudFront Distribution Oluştur

```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "platz-prod-'$(date +%s)'",
    "Origins": {
      "Quantity": 1,
      "Items": [
        {
          "Id": "platz-s3-origin",
          "DomainName": "platz-prod.s3.eu-central-1.amazonaws.com",
          "OriginAccessControlId": "<OAC_ID>",
          "S3OriginConfig": {
            "OriginAccessIdentity": ""
          }
        }
      ]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "platz-s3-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
      "ForwardedValues": {"QueryString": false, "Cookies": {"Forward": "none"}},
      "MinTTL": 0,
      "DefaultTTL": 86400,
      "MaxTTL": 31536000,
      "Compress": true
    },
    "Enabled": true,
    "Comment": "Platz CDN"
  }' --profile platz
```

Çıktıdaki `DomainName` değerini not edin (ör: `d3nvwcr0aykiys.cloudfront.net`).

### 3.3 S3 Bucket Policy — CloudFront Erişimi

```bash
DISTRIBUTION_ARN="arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"

aws s3api put-bucket-policy --bucket platz-prod --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::platz-prod/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "'$DISTRIBUTION_ARN'"
        }
      }
    }
  ]
}' --profile platz
```

---

## 4. MediaConvert IAM Role Oluşturma

### 4.1 Trust Policy Dosyası Oluştur

```bash
cat > /tmp/mediaconvert-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "mediaconvert.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
```

### 4.2 Role Oluştur

```bash
aws iam create-role \
  --role-name platz-mediaconvert-role \
  --assume-role-policy-document file:///tmp/mediaconvert-trust.json \
  --profile platz
```

### 4.3 S3 Erişim Politikası Ekle

```bash
aws iam put-role-policy \
  --role-name platz-mediaconvert-role \
  --policy-name MediaConvertS3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": "arn:aws:s3:::platz-prod/*"
      }
    ]
  }' --profile platz
```

Role ARN'ını not edin (ör: `arn:aws:iam::ACCOUNT_ID:role/platz-mediaconvert-role`).

---

## 5. MediaConvert Endpoint Öğrenme

```bash
aws mediaconvert describe-endpoints --region eu-central-1 --profile platz
```

Çıktıdaki `Url` değerini not edin (ör: `https://abcdefgh.mediaconvert.eu-central-1.amazonaws.com`).

---

## 6. SNS Topic Oluşturma

### 6.1 Topic Oluştur

```bash
aws sns create-topic \
  --name platz-mediaconvert-notifications \
  --region eu-central-1 \
  --profile platz
```

Topic ARN'ını not edin.

### 6.2 Topic Policy — EventBridge ve MediaConvert'ın Yayınlamasına İzin Ver

```bash
TOPIC_ARN="arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications"

aws sns set-topic-attributes \
  --topic-arn "$TOPIC_ARN" \
  --attribute-name Policy \
  --attribute-value '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowEventsPublish",
        "Effect": "Allow",
        "Principal": {"Service": "events.amazonaws.com"},
        "Action": "sns:Publish",
        "Resource": "'$TOPIC_ARN'"
      },
      {
        "Sid": "AllowMediaConvertPublish",
        "Effect": "Allow",
        "Principal": {"Service": "mediaconvert.amazonaws.com"},
        "Action": "sns:Publish",
        "Resource": "'$TOPIC_ARN'"
      }
    ]
  }' \
  --region eu-central-1 \
  --profile platz
```

---

## 7. EventBridge Rule Oluşturma

### 7.1 Rule Oluştur

```bash
aws events put-rule \
  --name platz-mediaconvert-events \
  --event-pattern '{
    "source": ["aws.mediaconvert"],
    "detail-type": ["MediaConvert Job State Change"],
    "detail": {
      "status": ["COMPLETE", "ERROR", "PROGRESSING"]
    }
  }' \
  --description "Capture MediaConvert job state changes" \
  --region eu-central-1 \
  --profile platz
```

### 7.2 SNS'i Target Olarak Ekle

```bash
aws events put-targets \
  --rule platz-mediaconvert-events \
  --targets "Id=sns-target,Arn=arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications" \
  --region eu-central-1 \
  --profile platz
```

---

## 8. SNS Subscription Oluşturma (API Webhook)

> **Önemli:** Bu adımı API sunucusu çalışıyor olmalı. API'nin webhook endpoint'i  
> (`https://api.yourdomain.com/webhooks/mediaconvert`) erişilebilir olmalı.

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications \
  --protocol https \
  --notification-endpoint https://api.yourdomain.com/webhooks/mediaconvert \
  --region eu-central-1 \
  --profile platz
```

API otomatik olarak subscription'ı onaylayacaktır. Doğrulamak için:

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications \
  --region eu-central-1 \
  --profile platz
```

`SubscriptionArn` değeri `PendingConfirmation` değil gerçek bir ARN olmalı.

---

## 9. API `.env` Dosyası

Sunucudaki `/var/www/platz-next/api/.env` dosyasına aşağıdaki değerleri ekleyin:

```env
# ─── Storage ───────────────────────────────────
STORAGE_DRIVER=s3
AWS_ACCESS_KEY_ID=<IAM kullanıcı access key>
AWS_SECRET_ACCESS_KEY=<IAM kullanıcı secret key>
AWS_REGION=eu-central-1
AWS_S3_BUCKET=platz-prod
AWS_ACCOUNT_ID=<12 haneli AWS hesap numarası>

# ─── CloudFront ────────────────────────────────
NEXT_PUBLIC_CLOUDFRONT_URL=<cloudfront domain, ör: d3nvwcr0aykiys.cloudfront.net>

# ─── Video Processing ─────────────────────────
VIDEO_PROCESSING_ENABLED=true
AWS_MEDIACONVERT_ENDPOINT=<describe-endpoints çıktısındaki URL>
AWS_MEDIACONVERT_ROLE=arn:aws:iam::<ACCOUNT_ID>:role/platz-mediaconvert-role
AWS_MEDIACONVERT_QUEUE=Default
AWS_SNS_MEDIACONVERT_TOPIC=arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications

# ─── Image Provider (birini seçin) ────────────
IMAGE_PROVIDER=imgix
NEXT_PUBLIC_IMGIX_URL=<imgix source domain>
NEXT_PUBLIC_IMGIX_SECURE_URL_TOKEN=<imgix token>
# veya ImageKit:
# IMAGE_PROVIDER=imagekit
# IMAGEKIT_URL_ENDPOINT=<imagekit url>
# IMAGEKIT_PUBLIC_KEY=<imagekit public key>
# IMAGEKIT_PRIVATE_KEY=<imagekit private key>
# NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=<imagekit url>
```

---

## 10. Client / Admin `.env.local` Dosyaları

### `admin/.env.local`

```env
NEXT_PUBLIC_PROTOCOL=https
NEXT_PUBLIC_HOSTNAME=admin.yourdomain.com
NEXT_PUBLIC_PORT=
NEXT_PUBLIC_IMGIX_URL=<imgix source domain>
```

### `client/.env.local`

```env
NEXT_PUBLIC_PROTOCOL=https
NEXT_PUBLIC_HOSTNAME=yourdomain.com
NEXT_PUBLIC_PORT=
NEXT_PUBLIC_IMGIX_URL=<imgix source domain>
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=<imagekit url, opsiyonel>
```

---

## 11. Doğrulama Kontrol Listesi

Her şeyi kurduktan sonra sırayla doğrulayın:

```bash
# 1. S3 erişimi
aws s3 ls s3://platz-prod --profile platz

# 2. CloudFront
curl -I https://<cloudfront-domain>/test-path

# 3. MediaConvert endpoint
aws mediaconvert describe-endpoints --region eu-central-1 --profile platz

# 4. MediaConvert role
aws iam get-role --role-name platz-mediaconvert-role --profile platz

# 5. SNS topic
aws sns get-topic-attributes \
  --topic-arn arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications \
  --region eu-central-1 --profile platz

# 6. EventBridge rule + target
aws events describe-rule --name platz-mediaconvert-events --region eu-central-1 --profile platz
aws events list-targets-by-rule --rule platz-mediaconvert-events --region eu-central-1 --profile platz

# 7. SNS subscription (confirmed olmalı)
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:eu-central-1:<ACCOUNT_ID>:platz-mediaconvert-notifications \
  --region eu-central-1 --profile platz

# 8. Webhook health check
curl https://api.yourdomain.com/webhooks/mediaconvert/health

# 9. Video yüklemesi sonrası API logları
pm2 logs api --lines 50 | grep -i "VideoProcessing\|MediaConvert"
```

---

## Sorun Giderme

| Belirti                                           | Olası Neden                               | Çözüm                                                                             |
| ------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Video "pending" durumunda kalıyor                 | SNS subscription yok/onaylanmamış         | `aws sns subscribe` komutunu çalıştır                                             |
| MediaConvert Jobs boş                             | `VIDEO_PROCESSING_ENABLED=true` değil     | `.env` dosyasını kontrol et                                                       |
| "MediaConvert client not configured" logu         | Env değişkenleri eksik                    | `isVideoProcessingConfigured()` için gereken 5 değişkeni kontrol et               |
| Job oluşturuluyor ama FAILED                      | IAM role S3 erişimi yok                   | Role'ün S3 policy'sinde bucket adını kontrol et                                   |
| Optimized dosyalar oluşuyor ama DB güncellenmiyor | EventBridge → SNS → Webhook zinciri kırık | Adım adım: rule target var mı, subscription confirmed mı, webhook erişilebilir mi |
| `AWS_ACCOUNT_ID` hatası                           | `.env`'de `AWS_ACCOUNT_ID` yok            | Hesap numarasını ekle                                                             |

---

## CloudFormation ile Otomatik Kurulum (Alternatif)

Yukarıdaki adımları tek seferde yapmak isterseniz:

```bash
aws cloudformation create-stack \
  --stack-name platz-video-processing \
  --template-body file://infra/cloudformation/video-processing.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=S3BucketName,ParameterValue=platz-prod \
    ParameterKey=ApiWebhookUrl,ParameterValue=https://api.yourdomain.com/webhooks/mediaconvert \
    ParameterKey=LambdaCodeS3Bucket,ParameterValue=platz-prod \
    ParameterKey=LambdaCodeS3Key,ParameterValue=lambda/video-processor.zip \
  --region eu-central-1 \
  --profile platz
```

> **Not:** CloudFormation, S3 bucket ve CloudFront distribution oluşturmaz.  
> Sadece MediaConvert role, SNS topic, EventBridge rule ve Lambda'yı kurar.  
> S3 ve CloudFront'u yukarıdaki adımlarla (2-3) manuel oluşturun.
