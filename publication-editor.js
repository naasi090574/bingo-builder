'use strict';

const publicationSection = document.querySelector('#publication-section');
const publicationLogin = document.querySelector('#publication-login');
const publicationProject = document.querySelector('#publication-project');
const publicationActions = document.querySelector('#publication-actions');
const publicationStatus = document.querySelector('#publication-status');
const publicationOutput = document.querySelector('#publication-output');
const publicationLink = document.querySelector('#publication-link');
const publicationEmbed = document.querySelector('#publication-embed');
const publicationOpen = document.querySelector('#publication-open');
const publicationRemove = document.querySelector('#publication-remove');
const publicationUpload = document.querySelector('#publication-upload');
let ownerToken;
let publicationBusy = false;

function displayPublication(publication) {
  publicationOutput.hidden = !publication;
  publicationRemove.hidden = !publication?.published;
  publicationUpload.textContent = publication?.published ? 'Обновить публикацию' : 'Опубликовать';
  if (!publication) return;
  const link = new URL('game.html', location.href);
  link.searchParams.set('published', publication.id);
  publicationLink.value = link.href;
  publicationOpen.href = link.href;
  publicationOpen.hidden = !publication.published;
  publicationEmbed.value = `<iframe src="${link.href.replaceAll('&', '&amp;')}" width="1280" height="720" title="Игра Бинго" style="border:0" allowfullscreen></iframe>`;
}

function refreshPublicationProjects(selected = publicationProject.value) {
  const previous = publicationProject.value;
  publicationProject.replaceChildren(...savedProjects.map(project => new Option(project.data.settings.title, project.id)));
  if (savedProjects.some(project => project.id === selected)) publicationProject.value = selected;
  publicationUpload.disabled = !savedProjects.length;
  if (previous !== publicationProject.value) displayPublication(null);
}

async function publicationOperation(action) {
  if (publicationBusy) return;
  publicationBusy = true;
  publicationSection.inert = true;
  try {
    await action();
  } catch (error) {
    publicationStatus.textContent = error.message;
    if (error.status === 401) signOutPublisher(false);
  } finally {
    publicationBusy = false;
    publicationSection.inert = false;
  }
}

function ownerCommand(action) {
  return publicationRequest('/functions/v1/publish-game', {
    token: ownerToken, body: { action, localId: publicationProject.value },
  });
}

async function showPublicationStatus() {
  displayPublication(null);
  if (!ownerToken || !publicationProject.value) return;
  const { publication } = await ownerCommand('status');
  displayPublication(publication);
  publicationStatus.textContent = publication?.published ? 'Игра опубликована.'
    : publication?.generation ? 'Игра снята с публикации.' : 'Игра ещё не опубликована.';
}

function signOutPublisher(announce = true) {
  ownerToken = undefined;
  publicationLogin.hidden = false;
  publicationActions.hidden = true;
  displayPublication(null);
  if (announce) publicationStatus.textContent = 'Вы вышли из учётной записи публикации.';
}

function openPublication(projectId, publish = false) {
  if (publicationBusy) return;
  refreshPublicationProjects(projectId);
  location.hash = 'genially';
  if (ownerToken) publicationOperation(publish ? publishSelectedProject : showPublicationStatus);
}

publicationLogin.addEventListener('submit', event => {
  event.preventDefault();
  publicationOperation(async () => {
    const credentials = new FormData(publicationLogin);
    const password = credentials.get('password');
    try {
      const session = await publicationRequest('/auth/v1/token?grant_type=password', {
        body: { email: credentials.get('email'), password },
      });
      ownerToken = session.access_token;
      // The server checks the actual account before the publisher UI is enabled.
      await publicationRequest('/functions/v1/publish-game', {
        token: ownerToken, body: { action: 'status', localId: publicationProject.value || 'no-saved-project' },
      });
      publicationLogin.hidden = true;
      publicationActions.hidden = false;
      publicationStatus.textContent = 'Вход выполнен.';
      await showPublicationStatus();
    } catch (error) {
      signOutPublisher(false);
      throw error;
    } finally {
      publicationLogin.elements.password.value = '';
    }
  });
});
document.querySelector('#publication-signout').addEventListener('click', () => signOutPublisher());
publicationProject.addEventListener('change', () => publicationOperation(showPublicationStatus));
async function publishSelectedProject() {
  const project = await readProject(publicationProject.value);
  if (!project) throw new Error('Сначала сохраните проект.');
  if (uniqueCards(project.data.cards.cards).length < project.data.settings.size ** 2) {
    throw new Error('В сохранённой игре недостаточно уникальных карточек для выбранного поля.');
  }
  publicationStatus.textContent = 'Подготовка файлов…';
  const { publication } = await uploadPublishedProject(project, ownerToken, (done, total) => {
    publicationStatus.textContent = `Загружено файлов: ${done} из ${total}.`;
  });
  displayPublication(publication);
  publicationStatus.textContent = 'Игра опубликована.';
}
publicationUpload.addEventListener('click', () => publicationOperation(publishSelectedProject));
publicationRemove.addEventListener('click', () => {
  if (!confirm('Снять игру с публикации? По ссылке игра станет недоступна.')) return;
  publicationOperation(async () => {
    const { publication } = await ownerCommand('unpublish');
    displayPublication(publication);
    publicationStatus.textContent = 'Игра снята с публикации.';
  });
});
for (const button of document.querySelectorAll('[data-copy-publication]')) {
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copyPublication);
    try {
      await navigator.clipboard.writeText(field.value);
      publicationStatus.textContent = 'Скопировано.';
    } catch {
      field.focus();
      field.select();
    }
  });
}

refreshPublicationProjects();
try {
  publicationEndpoint('/');
} catch (error) {
  publicationLogin.querySelector('button').disabled = true;
  publicationStatus.textContent = 'Подключите Supabase, чтобы публиковать игры.';
}
