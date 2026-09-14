# audio/ — optional model recordings

Drop native-speaker model recordings here to make the "Play model" control on
the /record screen use a real human production instead of the browser's speech
synthesiser.

## Naming

    <lang>_<task>.mp3

where `<lang>` is one of the ten language codes
(`en zh ms ta yue ja ko th my nan`) and `<task>` is `read` or `free`.

Examples:

    en_read.mp3     en_free.mp3
    zh_read.mp3     zh_free.mp3
    nan_read.mp3    nan_free.mp3

If a file is absent the app falls back to `speechSynthesis` at the language's
TTS locale (except Hokkien `nan`, which has no synthetic voice — a recorded
file is the only model source there).

These files are loaded locally only. No file here is fetched over the network.
