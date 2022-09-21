[<img src="./DEV/inSign_logo.svg" width="300" />](https://www.getinsign.com/)
------
**Sprachen: Deutsch (diese Datei), [Englisch](readme.md).**

# Allgemein

Dieses Java Projekt hilft Ihnen dabei, sich mit der Ansteuerung der inSign Java-API vertraut zu machen.
Es besteht aus den folgenden Teilen:

* Ein settings.xml mit der URL und einigen grundlegenden Anmeldedaten für den Zugriff auf die Artefakte aus dem privaten iS2 Maven Repository.
* Ein minimales pom.xml, welches das benötigte insign-java-api.jar importiert.
* Eine SimpleDemo.java Klasse, die einige grundlegende Verwendungen der API zeigt.

## Einrichtung

Die folgenden Schritte sind für die Einrichtung erforderlich:

Kopieren Sie zunächst das `settings.xml` in den lokalen `C:\Users\YOUR.USERNAME\.m2\` Ordner, falls die Datei dort noch nicht existiert. Wenn es bereits eine Konfigurationsdatei gibt, müssen Sie den Inhalt von `settings.xml` in die bereits bestehende Datei hinzufügen.<br />
Dies ermöglicht Ihnen den Zugriff auf die inSign-Abhängigkeiten aus dem privaten iS2-Maven-Repository.

Öffnen Sie danach die E-Mail, die Sie für die angeforderte Testinstanz erhalten haben.<br />
Dort befindet sich eine `URL` und das `Passwort` für den Controller.
Um die `aktuelle Version` abzurufen, melden Sie sich mit den `roadadmin` Zugangsdaten bei Deiner Instanz an. Dort befinden sich unten links die Build-Informationen.

<img src="./DEV/inSign-mail.png" width="800" />

Die Versionsnummer müssen Sie in das Property `insign.version` in der Datei pom.xml einfügen:

<img src="./DEV/setup_version.png" width="850" />

Öffnen Sie als Nächstes die Java-Klasse "SimpleDemo" und fügen Sie dort die URL aus der obigen E-Mail in die Variable "insignURL" ein.<br/>
Dasselbe gilt für das `controllerPassword`.

<img src="./DEV/setup_authentication.png" width="850" />

Nun kann der Maven-Build ausgeführt werden, um die erforderlichen Artefakte aus dem privaten iS2-Repository herunterzuladen und einzubinden.<br/>
Wenn Eclipse verwendet wird, geschieht dies durch einen Rechtsklick auf das Projekt ➜ `Run As` ➜ `Maven install`.<br/>
Klicken Sie danach erneut rechts und führen Sie ➜ `Maven` ➜ `Update project` aus.

Nach der Ausführung des `Maven install`-Befehls wird automatisch ein zweites Package in Ihrem Java-Sourceordner erstellt.
Dieses Package enthält mehrere Java-Klassen, die die erweiterte Nutzung zeigen. Um diese Beispiele ausführen zu können,
müssen Sie die gleichen Daten wie oben in `ApiData.java` eingeben.

<img src="./DEV/setup_test_api_data.png" width="850" />

## Verwendung

Jetzt sollten Sie in der Lage sein, SimpleDemo als Java-Anwendung auszuführen. Wenn alles korrekt eingerichtet wurde, wird der Browser geöffnet und das Testdokument angezeigt.

## Entwickelt von

[iS2 Intelligent Solution Services AG](https://www.is2.de/)

## Lizenz

    Copyright 2021 iS2 Intelligent Solution Services AG

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
