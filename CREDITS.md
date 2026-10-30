# 저작권 및 출처 (Credits)

## 음악
| 곡 | 연주 | 라이선스 | 출처 | 비고 |
| --- | --- | --- | --- | --- |
| Ave Maria (그레고리오 성가) | Schola Gregoriana — 폴란드 오우타제프(Ołtarzew) 팔로티회 신학교 합창단, 지휘 Dariusz Smolarek 신부, 2007년 6월 8일 녹음 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Ave_Maria.ogg) (Fundacja Caecilianum, WSD SAC 제공, VRT ticket #2008031210015414) | 원본 파일을 편집 없이 사용 (`public/audio/ave-maria-schola-gregoriana.ogg`) |
| Salve Regina (헤르만 콘트락투스) | Les Petits Chanteurs de Passy (파리 소년 합창단), 2012년 1월 14일 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Petits_Chanteurs_de_Passy_-_Salve_Regina_de_Hermann_Contract.ogg) | 원본 그대로 (`public/audio/salve-regina-petits-chanteurs-de-passy.ogg`) |
| Agnus Dei — Missa in Festis Apostolorum (팔레스트리나) | 악기(MIDI) 연주 버전, Knud Jeppesen 편 악보, 2018 | 퍼블릭 도메인 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Palestrina_Agnus_Dei_from_Missa_in_Festis_Apostolorum.ogg) | 원본 그대로 (`public/audio/palestrina-agnus-dei.ogg`) · 합창이 아닌 악기 소리 |
| Sicut lilium inter spinas (팔레스트리나) | The Tudor Consort, 2010 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Tudor_Consort_-_01_-_Palestrina_-_Sicut_lilium_inter_spinas.ogg) | 원본 그대로 (`public/audio/palestrina-sicut-lilium-tudor-consort.ogg`) |
| Miserere mei, Deus (알레그리) | Ensamble Escénico Vocal, 멕시코 틀락스칼라 대성당, 2021 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Allegri_-_Miserere_Mei,_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_(audio).ogg) | 원본 그대로 (`public/audio/allegri-miserere-ensamble-escenico-vocal.ogg`) |

- 위 순서대로 이어서 재생하고, 마지막 곡이 끝나면 처음부터 반복합니다(곡 사이 8초, 한 바퀴 뒤 20초 쉼).
- 곡 자체(그레고리오 성가, 팔레스트리나, 알레그리)는 모두 퍼블릭 도메인이며, 녹음은 각 행의 라이선스를 따릅니다.
- CC BY / CC BY-SA 3.0: 출처 표시가 필요하며, CC BY-SA는, 이 음원을 **변형한 파일**을 배포할 때는 같은 라이선스를 적용해야 합니다.
- 앱 안에서는 설정(⚙) → "음악 정보"에 같은 내용이 표시됩니다.
- 브라우저가 Ogg Vorbis를 재생하지 못하면(일부 iOS/Safari 버전) 직접 합성한 잔잔한 음으로 대신 재생합니다.

## 3D 모델·텍스처·효과음
성당 건축, 장의자, 제단, 3D 묵주, 스테인드글라스 무늬, 묵주알 소리는 코드로 직접 만들었습니다.

| 모델 | 출처 | 웹용 파일 |
| --- | --- | --- |
| 십자가상 | 프로젝트 소유자가 Meshy AI 로 생성 (원본 `object/Meshy_AI_crucifix_statue_…glb`, Git 제외) | `public/models/chapel/crucifix.glb` |
| 성모상 | 프로젝트 소유자가 Meshy AI 로 생성 (원본 `object/Meshy_AI_virgin_mary_statue_…glb`, Git 제외) | `public/models/chapel/mary.glb` |

두 모델은 프로젝트 소유자가 Meshy AI 로 직접 만든 소유 모델입니다.

| 그림 | 출처 | 웹용 파일 |
| --- | --- | --- |
| 천상의 영광 (제단 뒤 벽화) | 프로젝트 소유자가 이미지 생성 AI 로 만든 그림 (원본 `object/jesus.jpg`, Git 제외) | `public/art/glory-mural.jpg` (JPEG 82%) |
코드로 만든 예전 십자가상·성모상은 모델을 불러오는 동안·실패했을 때 대신 보입니다.

## 기도문
한국천주교주교회의 공식 기도문은 저작권이 있어 전문을 싣지 않았습니다. README의 "묵주기도와 저작권" 참고.
